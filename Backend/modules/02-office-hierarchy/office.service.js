import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn, overlaps, startOfTodayUtc } from '../../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseBooleanQuery, parseDate, parseIntId, parseUuid, requireString } from '../../utils/validation.js';

/**
 * Module 02 — Office hierarchy.
 * Offices form a single tree under one root (the university) via parentOfficeId.
 * OfficeType.levelOrder orders the tiers: a child must sit at a deeper level than its parent.
 */

const OFFICE_TYPE_SELECT = { id: true, name: true, description: true, levelOrder: true, isActive: true };
const OFFICE_REF_SELECT = { id: true, name: true, code: true };
const PERSON_REF_SELECT = { id: true, firstName: true, middleName: true, lastName: true, email: true };

const fullName = (person) => [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');
const personRef = (person) => ({ id: person.id, fullName: fullName(person), email: person.email });

const normalizeCode = (code) => (code ? code.toUpperCase() : code);

const assertScope = async (actor, code, officeId) => {
  if (!(await actor.access.can(code, officeId))) {
    throw forbidden(`You need ${code} authority over this office to perform this action`);
  }
};

const getOfficeOrThrow = async (id, include) => {
  const office = await prisma.office.findUnique({ where: { id }, include });
  if (!office) throw notFound('Office not found');
  return office;
};

const getActiveOfficeOrThrow = async (id) => {
  const office = await getOfficeOrThrow(id);
  if (!office.isActive) throw badRequest(`Office "${office.name}" is inactive`);
  return office;
};

/**
 * Tier rule: a child office type must have a larger levelOrder than its parent's (when both are set).
 */
const assertTierOrder = (childType, parentType) => {
  if (childType?.levelOrder == null || parentType?.levelOrder == null) return;
  if (childType.levelOrder <= parentType.levelOrder) {
    throw badRequest(
      `A ${childType.name} (level ${childType.levelOrder}) cannot be placed under a ${parentType.name} (level ${parentType.levelOrder})`
    );
  }
};

const assertCodeAvailable = async (code, exceptOfficeId) => {
  if (!code) return;
  const existing = await prisma.office.findUnique({ where: { code } });
  if (existing && existing.id !== exceptOfficeId) throw conflict(`Office code "${code}" is already used by "${existing.name}"`);
};

// ===== Tree helpers (shared with other modules) =====

/**
 * IDs of the office and every office below it (self first). Empty array if the office does not exist.
 * Used for "include sub-offices" targeting, scoped listings and cycle prevention.
 */
export const getOfficeDescendantIds = async (officeId) => {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE subtree AS (
      SELECT id FROM office WHERE id = ${officeId}::uuid
      UNION ALL
      SELECT o.id FROM office o JOIN subtree s ON o.parent_office_id = s.id
    )
    SELECT id FROM subtree`;
  return rows.map((row) => row.id);
};

// ===== Office types =====

export const listOfficeTypes = async () => {
  const types = await prisma.officeType.findMany({
    orderBy: [{ levelOrder: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    include: { _count: { select: { offices: true } } },
  });
  return types.map(({ _count, ...type }) => ({ ...type, officeCount: _count.offices }));
};

export const createOfficeType = async ({ name, description, levelOrder } = {}, actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.OFFICE_MANAGE)) {
    throw forbidden('Defining office types requires university-wide office:manage authority');
  }

  const cleanName = requireString(name, 'name');
  const level = parseIntId(levelOrder, 'levelOrder', { required: false }) ?? null;

  const duplicate = await prisma.officeType.findFirst({ where: { name: { equals: cleanName, mode: 'insensitive' } } });
  if (duplicate) throw conflict(`Office type "${duplicate.name}" already exists`);

  const officeType = await prisma.officeType.create({ data: { name: cleanName, description: optionalString(description, 'description') ?? null, levelOrder: level }, select: OFFICE_TYPE_SELECT });
  await auditAction(actor, { action: 'OFFICE_TYPE_CREATED', entityType: 'office_type', entityId: officeType.id, newValues: officeType });
  return officeType;
};

// ===== Offices =====

export const listOffices = async ({ officeTypeId, parentOfficeId, isActive, search } = {}) => {
  const where = {};
  const typeId = parseUuid(officeTypeId, 'officeTypeId', { required: false });
  const active = parseBooleanQuery(isActive, 'isActive');
  if (typeId) where.officeTypeId = typeId;
  if (parentOfficeId) where.parentOfficeId = parentOfficeId;
  if (active !== undefined) where.isActive = active;
  if (search?.trim()) {
    where.OR = [{ name: { contains: search.trim(), mode: 'insensitive' } }, { code: { contains: search.trim(), mode: 'insensitive' } }];
  }

  const offices = await prisma.office.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      officeType: { select: OFFICE_TYPE_SELECT },
      parent: { select: OFFICE_REF_SELECT },
      _count: { select: { children: true } },
    },
  });
  return offices.map(({ _count, ...office }) => ({ ...office, childCount: _count.children }));
};

/**
 * Office profile: type, parent, direct children, positions (with active holder counts) and the current head.
 */
export const getOfficeById = async (id) => {
  const office = await getOfficeOrThrow(id, {
    officeType: { select: OFFICE_TYPE_SELECT },
    parent: { select: OFFICE_REF_SELECT },
    children: {
      orderBy: { name: 'asc' },
      select: { ...OFFICE_REF_SELECT, isActive: true, officeType: { select: { id: true, name: true } } },
    },
    positions: {
      orderBy: [{ isHead: 'desc' }, { title: 'asc' }],
      include: { _count: { select: { officePersons: { where: activeOn('startDate', 'endDate') } } } },
    },
  });

  const headPlacement = await prisma.officePerson.findFirst({
    where: { officeId: id, position: { isHead: true }, ...activeOn('startDate', 'endDate') },
    include: { person: { select: PERSON_REF_SELECT }, position: { select: { id: true, title: true } } },
  });

  const { positions, ...rest } = office;
  return {
    ...rest,
    positions: positions.map(({ _count, ...position }) => ({ ...position, holderCount: _count.officePersons })),
    head: headPlacement
      ? {
          placementId: headPlacement.id,
          person: personRef(headPlacement.person),
          position: headPlacement.position,
          startDate: headPlacement.startDate,
        }
      : null,
  };
};

export const createOffice = async ({ name, code, officeTypeId, parentOfficeId, canAssignKpi } = {}, actor) => {
  const cleanName = requireString(name, 'name');
  const cleanCode = normalizeCode(optionalString(code, 'code'));
  const typeId = parseUuid(officeTypeId, 'officeTypeId');
  const canAssign = parseBoolean(canAssignKpi, 'canAssignKpi') ?? true;

  const officeType = await prisma.officeType.findUnique({ where: { id: typeId } });
  if (!officeType) throw badRequest('Office type not found');

  if (parentOfficeId) {
    const parent = await getOfficeOrThrow(parentOfficeId, { officeType: true }).catch(() => {
      throw badRequest('Parent office not found');
    });
    if (!parent.isActive) throw badRequest(`Parent office "${parent.name}" is inactive`);
    assertTierOrder(officeType, parent.officeType);
    await assertScope(actor, PERMISSIONS.OFFICE_CREATE, parent.id);
  } else {
    const root = await prisma.office.findFirst({ where: { parentOfficeId: null }, select: { name: true } });
    if (root) throw badRequest(`parentOfficeId is required: the root office "${root.name}" already exists`);
    if (!actor.access.canGlobally(PERMISSIONS.OFFICE_CREATE)) {
      throw forbidden('Creating the root office requires university-wide office:create authority');
    }
  }
  await assertCodeAvailable(cleanCode);

  const office = await prisma.$transaction(async (tx) => {
    const created = await tx.office.create({
      data: { name: cleanName, code: cleanCode ?? null, officeTypeId: typeId, parentOfficeId: parentOfficeId || null, canAssignKpi: canAssign },
    });
    await tx.officeHierarchyHistory.create({
      data: { officeId: created.id, parentOfficeId: created.parentOfficeId, validFrom: startOfTodayUtc(), changedByPersonId: actor.personId },
    });
    return created;
  });
  await auditAction(actor, { action: 'OFFICE_CREATED', entityType: 'office', entityId: office.id, newValues: office });
  return getOfficeById(office.id);
};

/**
 * Update name, code, type, parent, KPI-assigning flag or active flag.
 * Re-parenting is refused when the new parent is the office itself or one of its descendants (would create a cycle),
 * and closes the current hierarchy history row and opens a new one (data.reason is recorded on it).
 */
export const updateOffice = async (id, data = {}, actor) => {
  const existing = await getOfficeOrThrow(id, {
    officeType: true,
    parent: { include: { officeType: true } },
    children: { include: { officeType: true } },
  });
  await assertScope(actor, PERMISSIONS.OFFICE_UPDATE, id);

  const update = {};
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.code !== undefined) {
    update.code = normalizeCode(optionalString(data.code, 'code'));
    await assertCodeAvailable(update.code, id);
  }

  let officeType = existing.officeType;
  if (data.officeTypeId !== undefined) {
    const typeId = parseUuid(data.officeTypeId, 'officeTypeId');
    officeType = await prisma.officeType.findUnique({ where: { id: typeId } });
    if (!officeType) throw badRequest('Office type not found');
    update.officeTypeId = typeId;
  }

  let parent = existing.parent;
  if (data.parentOfficeId !== undefined && data.parentOfficeId !== existing.parentOfficeId) {
    if (!existing.parentOfficeId) throw badRequest('The root office cannot be moved under another office');
    if (!data.parentOfficeId) throw badRequest('Only one root office is allowed; parentOfficeId is required');

    const subtree = await getOfficeDescendantIds(id);
    if (subtree.includes(data.parentOfficeId)) {
      throw badRequest('An office cannot be moved under itself or one of its sub-offices');
    }

    parent = await getOfficeOrThrow(data.parentOfficeId, { officeType: true }).catch(() => {
      throw badRequest('Parent office not found');
    });
    if (!parent.isActive) throw badRequest(`Parent office "${parent.name}" is inactive`);
    // Moving an office into another branch also requires authority over the destination
    await assertScope(actor, PERMISSIONS.OFFICE_UPDATE, parent.id);
    update.parentOfficeId = parent.id;
  }

  if (update.officeTypeId !== undefined || update.parentOfficeId !== undefined) {
    if (parent) assertTierOrder(officeType, parent.officeType);
    for (const child of existing.children) assertTierOrder(child.officeType, officeType);
  }

  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined && isActive !== existing.isActive) {
    if (!isActive && existing.children.some((child) => child.isActive)) {
      throw conflict('Deactivate or move the active sub-offices first');
    }
    if (isActive && parent && !parent.isActive) throw badRequest(`Parent office "${parent.name}" is inactive`);
    if (!isActive && !existing.parentOfficeId) throw badRequest('The root office cannot be deactivated');
    update.isActive = isActive;
  }

  const canAssignKpi = parseBoolean(data.canAssignKpi, 'canAssignKpi');
  if (canAssignKpi !== undefined) update.canAssignKpi = canAssignKpi;

  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const { officeType: _type, parent: _parent, children: _children, ...before } = existing;
  const reason = optionalString(data.reason, 'reason') ?? null;
  const updated = await prisma.$transaction(async (tx) => {
    if (update.parentOfficeId !== undefined) {
      const today = startOfTodayUtc();
      await tx.officeHierarchyHistory.updateMany({ where: { officeId: id, validTo: null }, data: { validTo: today } });
      await tx.officeHierarchyHistory.create({
        data: { officeId: id, parentOfficeId: update.parentOfficeId, validFrom: today, reason, changedByPersonId: actor.personId },
      });
    }
    return tx.office.update({ where: { id }, data: update });
  });
  await auditAction(actor, { action: 'OFFICE_UPDATED', entityType: 'office', entityId: id, oldValues: before, newValues: updated, reason });
  return getOfficeById(id);
};

/**
 * Parents this office has had, newest first.
 */
export const getOfficeHistory = async (id) => {
  await getOfficeOrThrow(id);
  const rows = await prisma.officeHierarchyHistory.findMany({
    where: { officeId: id },
    orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    include: { parent: { select: OFFICE_REF_SELECT }, changedBy: { select: PERSON_REF_SELECT } },
  });
  return rows.map(({ changedBy, ...row }) => ({ ...row, changedBy: changedBy ? personRef(changedBy) : null }));
};

/**
 * The whole office structure as a nested tree (one query, assembled in memory).
 */
export const getOfficeTree = async () => {
  const offices = await prisma.office.findMany({
    select: { ...OFFICE_REF_SELECT, isActive: true, parentOfficeId: true, officeType: { select: OFFICE_TYPE_SELECT } },
    orderBy: { name: 'asc' },
  });

  const nodes = new Map(offices.map(({ parentOfficeId, ...office }) => [office.id, { ...office, parentOfficeId, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parentNode = node.parentOfficeId && nodes.get(node.parentOfficeId);
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  }
  // offices are already sorted by name, so children arrays are too
  const strip = ({ parentOfficeId, children, ...node }) => ({ ...node, children: children.map(strip) });
  return roots.map(strip);
};

// ===== Positions =====

export const listPositions = async (officeId) => {
  await getOfficeOrThrow(officeId);
  const positions = await prisma.position.findMany({
    where: { officeId },
    orderBy: [{ isHead: 'desc' }, { title: 'asc' }],
    include: { _count: { select: { officePersons: { where: activeOn('startDate', 'endDate') } } } },
  });
  return positions.map(({ _count, ...position }) => ({ ...position, holderCount: _count.officePersons }));
};

export const createPosition = async (officeId, { title, isHead } = {}, actor) => {
  const office = await getActiveOfficeOrThrow(officeId);
  await assertScope(actor, PERMISSIONS.OFFICE_MANAGE, officeId);

  const cleanTitle = requireString(title, 'title');
  const head = parseBoolean(isHead, 'isHead') ?? false;

  const duplicate = await prisma.position.findFirst({ where: { officeId, title: { equals: cleanTitle, mode: 'insensitive' } } });
  if (duplicate) throw conflict(`Position "${duplicate.title}" already exists in ${office.name}`);
  if (head) {
    const existingHead = await prisma.position.findFirst({ where: { officeId, isHead: true } });
    if (existingHead) throw conflict(`${office.name} already has a head position ("${existingHead.title}")`);
  }

  const position = await prisma.position.create({ data: { officeId, title: cleanTitle, isHead: head } });
  await auditAction(actor, { action: 'POSITION_CREATED', entityType: 'position', entityId: position.id, newValues: position });
  return position;
};

// ===== Members (OfficePerson placements) =====

const PLACEMENT_INCLUDE = {
  person: { select: { ...PERSON_REF_SELECT, isActive: true } },
  position: { select: { id: true, title: true, isHead: true } },
  roles: {
    where: activeOn('validFrom', 'validTo'),
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      role: { select: { id: true, name: true } },
      scopeOffice: { select: OFFICE_REF_SELECT },
    },
  },
};

const formatPlacement = ({ person, ...placement }) => ({ ...placement, person: { ...personRef(person), isActive: person.isActive } });

/**
 * Currently active placements in the office, heads first.
 */
export const listMembers = async (officeId) => {
  await getOfficeOrThrow(officeId);
  const placements = await prisma.officePerson.findMany({
    where: { officeId, ...activeOn('startDate', 'endDate') },
    orderBy: [{ position: { isHead: 'desc' } }, { startDate: 'asc' }],
    include: PLACEMENT_INCLUDE,
  });
  return placements.map(formatPlacement);
};

/**
 * Place a person in a position of the office for a tenure window.
 * - the position must belong to this office
 * - the same person cannot hold the same position twice in overlapping windows
 * - a head position has a single holder at any time
 * - isPrimary moves the person's primary flag here (their first placement is primary automatically)
 */
export const assignMember = async (officeId, { personId, positionId, startDate, endDate, isPrimary } = {}, actor) => {
  await getActiveOfficeOrThrow(officeId);
  await assertScope(actor, PERMISSIONS.OFFICE_ASSIGN, officeId);

  if (!personId) throw badRequest('personId is required');
  if (!positionId) throw badRequest('positionId is required');
  const start = parseDate(startDate, 'startDate');
  const end = parseDate(endDate, 'endDate', { required: false });
  if (end && end < start) throw badRequest('endDate must be on or after startDate');
  const primaryRequested = parseBoolean(isPrimary, 'isPrimary');

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) throw badRequest('Person not found');
  if (!person.isActive) throw badRequest(`${fullName(person)} is inactive and cannot be placed`);

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position || position.officeId !== officeId) throw badRequest('Position not found in this office');

  const window = overlaps('startDate', 'endDate', start, end);
  const samePersonOverlap = await prisma.officePerson.findFirst({ where: { personId, positionId, ...window } });
  if (samePersonOverlap) throw conflict(`${fullName(person)} already holds "${position.title}" during this period`);

  if (position.isHead) {
    const holder = await prisma.officePerson.findFirst({
      where: { positionId, ...window },
      include: { person: { select: PERSON_REF_SELECT } },
    });
    if (holder) throw conflict(`"${position.title}" is already held by ${fullName(holder.person)} during this period`);
  }

  const hasOtherPlacements = (await prisma.officePerson.count({ where: { personId, ...activeOn('startDate', 'endDate') } })) > 0;
  const makePrimary = primaryRequested ?? !hasOtherPlacements;

  const placement = await prisma.$transaction(async (tx) => {
    if (makePrimary) await tx.officePerson.updateMany({ where: { personId, isPrimary: true }, data: { isPrimary: false } });
    return tx.officePerson.create({
      data: { personId, officeId, positionId, startDate: start, endDate: end, isPrimary: makePrimary },
      include: PLACEMENT_INCLUDE,
    });
  });

  await auditAction(actor, {
    action: 'MEMBER_ASSIGNED',
    entityType: 'office_person',
    entityId: placement.id,
    newValues: { personId, officeId, positionId, startDate: start, endDate: end, isPrimary: makePrimary },
  });
  return formatPlacement(placement);
};

export default {
  getOfficeDescendantIds,
  listOfficeTypes,
  createOfficeType,
  getOfficeTree,
  listOffices,
  getOfficeById,
  createOffice,
  updateOffice,
  getOfficeHistory,
  listPositions,
  createPosition,
  listMembers,
  assignMember,
};
