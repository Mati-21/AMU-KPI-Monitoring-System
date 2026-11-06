import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { getActiveGrants, isSuperAdmin } from '../03-access-control/access.service.js';
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

/**
 * Ids of the offices a person may see: where they are placed today. office:read_all adds everything below, while
 * contract:manage adds just the offices directly below, because that is who it gives contracts to. A Super Admin sees
 * all (null).
 */
const visibleOfficeIds = async (actor) => {
  const grants = await getActiveGrants(actor.personId);
  if (isSuperAdmin(grants)) return null;
  const placements = await prisma.officePerson.findMany({ where: { personId: actor.personId, ...activeOn('startDate', 'endDate') }, select: { officeId: true } });
  const own = [...new Set(placements.map((placement) => placement.officeId))];
  const holds = (code) => grants.some((grant) => grant.code === code);

  if (holds(PERMISSIONS.OFFICE_READ_ALL)) return [...new Set((await Promise.all(own.map(getOfficeDescendantIds))).flat())];
  if (!holds(PERMISSIONS.CONTRACT_MANAGE)) return own;
  const directlyBelow = await prisma.office.findMany({ where: { parentOfficeId: { in: own } }, select: { id: true } });
  return [...own, ...directlyBelow.map((office) => office.id)];
};

// Not found rather than forbidden, so an office outside the person's part of the tree stays unknown to them
export const assertOfficeVisible = async (id, actor) => {
  const visible = await visibleOfficeIds(actor);
  if (visible && !visible.includes(id)) throw notFound('Office not found');
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
  assertCanDefineOfficeTypes(actor);

  const cleanName = requireString(name, 'name');
  const level = parseIntId(levelOrder, 'levelOrder', { required: false }) ?? null;

  const duplicate = await prisma.officeType.findFirst({ where: { name: { equals: cleanName, mode: 'insensitive' } } });
  if (duplicate) throw conflict(`Office type "${duplicate.name}" already exists`);

  const officeType = await prisma.officeType.create({ data: { name: cleanName, description: optionalString(description, 'description') ?? null, levelOrder: level }, select: OFFICE_TYPE_SELECT });
  await auditAction(actor, { action: 'OFFICE_TYPE_CREATED', entityType: 'office_type', entityId: officeType.id, newValues: officeType });
  return officeType;
};

const getOfficeTypeOrThrow = async (id) => {
  const officeType = await prisma.officeType.findUnique({ where: { id }, select: OFFICE_TYPE_SELECT });
  if (!officeType) throw notFound('Office type not found');
  return officeType;
};

const assertCanDefineOfficeTypes = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.OFFICE_MANAGE)) {
    throw forbidden('Defining office types requires university-wide office:manage authority');
  }
};

/**
 * A new level must still fit every office of this type and the offices around it.
 */
const assertLevelFitsOffices = async (officeType) => {
  const offices = await prisma.office.findMany({
    where: { officeTypeId: officeType.id },
    include: { parent: { include: { officeType: true } }, children: { include: { officeType: true } } },
  });
  for (const office of offices) {
    if (office.parent) assertTierOrder(officeType, office.parent.officeType);
    for (const child of office.children) assertTierOrder(child.officeType, officeType);
  }
};

export const updateOfficeType = async (id, data = {}, actor) => {
  assertCanDefineOfficeTypes(actor);
  const existing = await getOfficeTypeOrThrow(id);

  const update = {};
  if (data.name !== undefined) {
    update.name = requireString(data.name, 'name');
    const duplicate = await prisma.officeType.findFirst({ where: { id: { not: id }, name: { equals: update.name, mode: 'insensitive' } } });
    if (duplicate) throw conflict(`Office type "${duplicate.name}" already exists`);
  }
  if (data.description !== undefined) update.description = optionalString(data.description, 'description') ?? null;
  if (data.levelOrder !== undefined) {
    update.levelOrder = parseIntId(data.levelOrder, 'levelOrder', { required: false }) ?? null;
    await assertLevelFitsOffices({ ...existing, levelOrder: update.levelOrder });
  }
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const officeType = await prisma.officeType.update({ where: { id }, data: update, select: OFFICE_TYPE_SELECT });
  await auditAction(actor, { action: 'OFFICE_TYPE_UPDATED', entityType: 'office_type', entityId: id, oldValues: existing, newValues: officeType });
  return officeType;
};

export const deleteOfficeType = async (id, actor) => {
  assertCanDefineOfficeTypes(actor);
  const existing = await getOfficeTypeOrThrow(id);
  const officeCount = await prisma.office.count({ where: { officeTypeId: id } });
  if (officeCount > 0) throw conflict(`"${existing.name}" is used by ${officeCount} office(s) and cannot be deleted`);

  await prisma.officeType.delete({ where: { id } });
  await auditAction(actor, { action: 'OFFICE_TYPE_DELETED', entityType: 'office_type', entityId: id, oldValues: existing });
};

// ===== Offices =====

export const listOffices = async ({ officeTypeId, parentOfficeId, isActive, search } = {}, actor) => {
  const where = {};
  const visible = await visibleOfficeIds(actor);
  if (visible) where.id = { in: visible };
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
      where: { archivedAt: null },
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
export const getOfficeTree = async (actor) => {
  const visible = await visibleOfficeIds(actor);
  const offices = await prisma.office.findMany({
    where: visible ? { id: { in: visible } } : {},
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

/**
 * What still depends on an office, in words. Each of these would lose its meaning without the office.
 */
const officeDependencies = async (id) => {
  const today = startOfTodayUtc();
  const stillRunning = { OR: [{ endDate: null }, { endDate: { gte: today } }] };
  const counts = await Promise.all([
    prisma.office.count({ where: { parentOfficeId: id } }),
    prisma.officePerson.count({ where: { officeId: id, ...stillRunning } }),
    prisma.officePersonRole.count({ where: { scopeOfficeId: id, OR: [{ validTo: null }, { validTo: { gte: today } }], officePerson: stillRunning } }),
    prisma.performanceContract.count({ where: { OR: [{ officeId: id }, { assigningOfficeId: id }] } }),
    prisma.kpi.count({ where: { coordinatingOfficeId: id } }),
    prisma.performanceReview.count({ where: { reviewerOfficeId: id } }),
    prisma.document.count({ where: { ownerOfficeId: id } }),
    prisma.responsibilityAllocation.count({ where: { childOfficeId: id } }),
    // Offices that used to sit under this one and have since moved away
    prisma.officeHierarchyHistory.count({ where: { parentOfficeId: id, office: { NOT: { parentOfficeId: id } } } }),
  ]);
  const words = ['sub-office(s)', 'person(s) placed in it', 'role assignment(s) limited to it', 'contract(s)', 'KPI(s) it coordinates', 'report review(s)', 'document(s)', 'KPI share(s)', 'past sub-office record(s)'];
  return counts.flatMap((count, index) => (count > 0 ? [`${count} ${words[index]}`] : []));
};

/**
 * Delete an office nothing depends on. Its positions and ended placements go with it; the system log keeps the record.
 * An office that was really used keeps its history, so it can only be deactivated.
 */
export const deleteOffice = async (id, actor) => {
  const office = await getOfficeOrThrow(parseUuid(id, 'id'));
  await assertScope(actor, PERMISSIONS.OFFICE_MANAGE, id);
  if (!office.parentOfficeId) throw conflict('The top office cannot be deleted');

  const dependencies = await officeDependencies(id);
  if (dependencies.length > 0) throw conflict(`${office.name} cannot be deleted because it still has ${dependencies.join(', ')}. Remove them first, or deactivate the office instead.`, { dependencies });

  const placements = await prisma.officePerson.findMany({ where: { officeId: id }, select: { id: true, personId: true, positionId: true, startDate: true, endDate: true } });
  const inOffice = { officePerson: { officeId: id } };
  try {
    await prisma.$transaction([
      prisma.officePersonRole.deleteMany({ where: { OR: [inOffice, { scopeOfficeId: id }] } }),
      prisma.officePerson.deleteMany({ where: { officeId: id } }),
      prisma.position.deleteMany({ where: { officeId: id } }),
      prisma.officeHierarchyHistory.deleteMany({ where: { officeId: id } }),
      prisma.notification.updateMany({ where: { targetOfficeId: id }, data: { targetOfficeId: null } }),
      prisma.office.delete({ where: { id } }),
    ]);
  } catch (error) {
    if (error.code !== 'P2003') throw error;
    throw conflict(`${office.name} cannot be deleted because other records still use it. Deactivate the office instead.`);
  }
  await auditAction(actor, { action: 'OFFICE_DELETED', entityType: 'office', entityId: id, oldValues: { name: office.name, code: office.code, parentOfficeId: office.parentOfficeId, officeTypeId: office.officeTypeId, placements } });
};

// ===== Positions =====

export const listPositions = async (officeId) => {
  await getOfficeOrThrow(officeId);
  const positions = await prisma.position.findMany({
    where: { officeId, archivedAt: null },
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

  const duplicate = await prisma.position.findFirst({ where: { officeId, archivedAt: null, title: { equals: cleanTitle, mode: 'insensitive' } } });
  if (duplicate) throw conflict(`Position "${duplicate.title}" already exists in ${office.name}`);
  if (head) {
    const existingHead = await prisma.position.findFirst({ where: { officeId, isHead: true, archivedAt: null } });
    if (existingHead) throw conflict(`${office.name} already has a head position ("${existingHead.title}")`);
  }

  const position = await prisma.position.create({ data: { officeId, title: cleanTitle, isHead: head } });
  await auditAction(actor, { action: 'POSITION_CREATED', entityType: 'position', entityId: position.id, newValues: position });
  return position;
};

const getPositionOrThrow = async (id, actor) => {
  const position = await prisma.position.findUnique({ where: { id } });
  if (!position || position.archivedAt) throw notFound('Position not found');
  await assertScope(actor, PERMISSIONS.OFFICE_MANAGE, position.officeId);
  return position;
};

export const updatePosition = async (id, { title, isHead } = {}, actor) => {
  const existing = await getPositionOrThrow(id, actor);

  const update = {};
  if (title !== undefined) {
    update.title = requireString(title, 'title');
    const duplicate = await prisma.position.findFirst({ where: { id: { not: id }, officeId: existing.officeId, archivedAt: null, title: { equals: update.title, mode: 'insensitive' } } });
    if (duplicate) throw conflict(`Position "${duplicate.title}" already exists in this office`);
  }
  const head = parseBoolean(isHead, 'isHead');
  if (head !== undefined) update.isHead = head;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  if (update.isHead && !existing.isHead) {
    const existingHead = await prisma.position.findFirst({ where: { officeId: existing.officeId, isHead: true, archivedAt: null } });
    if (existingHead) throw conflict(`This office already has a head position ("${existingHead.title}")`);
    const holders = await prisma.officePerson.count({ where: { positionId: id, ...activeOn('startDate', 'endDate') } });
    if (holders > 1) throw conflict('A head position has a single holder, and this position has several');
  }

  const position = await prisma.position.update({ where: { id }, data: update });
  await auditAction(actor, { action: 'POSITION_UPDATED', entityType: 'position', entityId: id, oldValues: existing, newValues: position });
  return position;
};

/**
 * Removes a position nobody holds today. One that was never held is deleted; one held before is archived instead,
 * because past placements point to it: it leaves every list, and history still shows its title.
 * Returns { archived }.
 */
export const deletePosition = async (id, actor) => {
  const existing = await getPositionOrThrow(id, actor);
  const current = await prisma.officePerson.findFirst({
    where: { positionId: id, OR: [{ endDate: null }, { endDate: { gte: startOfTodayUtc() } }] },
    include: { person: { select: PERSON_REF_SELECT } },
  });
  if (current) throw conflict(`${fullName(current.person)} still holds "${existing.title}". End their placement first.`);

  const held = await prisma.officePerson.count({ where: { positionId: id } });
  if (held > 0) {
    await prisma.position.update({ where: { id }, data: { archivedAt: new Date() } });
    await auditAction(actor, { action: 'POSITION_ARCHIVED', entityType: 'position', entityId: id, oldValues: existing });
    return { archived: true };
  }

  await prisma.position.delete({ where: { id } });
  await auditAction(actor, { action: 'POSITION_DELETED', entityType: 'position', entityId: id, oldValues: existing });
  return { archived: false };
};

// ===== Members (OfficePerson placements) =====

const placementInclude = () => ({
  person: { select: { ...PERSON_REF_SELECT, isActive: true } },
  position: { select: { id: true, title: true, isHead: true } },
  // Includes roles starting later, so they can be seen and revoked before they begin
  roles: {
    where: { OR: [{ validTo: null }, { validTo: { gte: startOfTodayUtc() } }] },
    select: {
      id: true,
      validFrom: true,
      validTo: true,
      role: { select: { id: true, name: true } },
      scopeOffice: { select: OFFICE_REF_SELECT },
    },
  },
});

const formatPlacement = ({ person, ...placement }) => ({ ...placement, person: { ...personRef(person), isActive: person.isActive } });

/**
 * Currently active placements in the office, heads first.
 */
export const listMembers = async (officeId) => {
  await getOfficeOrThrow(officeId);
  const placements = await prisma.officePerson.findMany({
    where: { officeId, person: { isActive: true }, ...activeOn('startDate', 'endDate') },
    orderBy: [{ position: { isHead: 'desc' } }, { startDate: 'asc' }],
    include: placementInclude(),
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
  // A placement starts today unless a date is given, and runs until it is ended
  const start = startDate ? parseDate(startDate, 'startDate') : startOfTodayUtc();
  const end = parseDate(endDate, 'endDate', { required: false });
  if (end && end < start) throw badRequest('endDate must be on or after startDate');
  const primaryRequested = parseBoolean(isPrimary, 'isPrimary');

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) throw badRequest('Person not found');
  if (!person.isActive) throw badRequest(`${fullName(person)} is inactive and cannot be placed`);

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position || position.archivedAt || position.officeId !== officeId) throw badRequest('Position not found in this office');

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
      include: placementInclude(),
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

/**
 * Ending a Super Admin's placement also ends their access, so it has the same protections as revoking the role.
 */
const assertCanEndPlacement = async (placement, actor) => {
  if (!actor.access.isSuperAdmin && isSuperAdmin(await getActiveGrants(placement.personId))) {
    throw forbidden('Only a Super Admin can end a Super Admin placement');
  }
  const superAdminRole = await prisma.officePersonRole.findFirst({ where: { officePersonId: placement.id, role: { isSystem: true }, ...activeOn('validFrom', 'validTo') } });
  if (!superAdminRole) return;
  const others = await prisma.officePersonRole.count({
    where: { roleId: superAdminRole.roleId, officePersonId: { not: placement.id }, ...activeOn('validFrom', 'validTo'), officePerson: activeOn('startDate', 'endDate') },
  });
  if (others === 0) throw conflict('This is the last active Super Admin, so this placement cannot end');
};

/**
 * Set the last day of a running placement. It stays active through that day, and its roles stop with it.
 */
export const endPlacement = async (id, { endDate } = {}, actor) => {
  const placement = await prisma.officePerson.findUnique({ where: { id }, include: { position: true } });
  if (!placement) throw notFound('Office placement not found');
  await assertScope(actor, PERMISSIONS.OFFICE_ASSIGN, placement.officeId);
  if (placement.endDate && placement.endDate < startOfTodayUtc()) throw badRequest('This placement has already ended');

  const end = parseDate(endDate, 'endDate');
  if (end < placement.startDate) throw badRequest('endDate must be on or after the start date');
  await assertCanEndPlacement(placement, actor);

  // A later date can run into whoever took over the position
  const clash = await prisma.officePerson.findFirst({
    where: { id: { not: id }, positionId: placement.positionId, ...(placement.position.isHead ? {} : { personId: placement.personId }), ...overlaps('startDate', 'endDate', placement.startDate, end) },
  });
  if (clash) throw conflict(`"${placement.position.title}" is already held during this period`);

  const updated = await prisma.officePerson.update({ where: { id }, data: { endDate: end }, include: placementInclude() });
  await auditAction(actor, { action: 'MEMBER_PLACEMENT_ENDED', entityType: 'office_person', entityId: id, oldValues: { endDate: placement.endDate }, newValues: { endDate: end } });
  return formatPlacement(updated);
};

export default {
  getOfficeDescendantIds,
  assertOfficeVisible,
  deleteOffice,
  listOfficeTypes,
  createOfficeType,
  updateOfficeType,
  deleteOfficeType,
  getOfficeTree,
  listOffices,
  getOfficeById,
  createOffice,
  updateOffice,
  getOfficeHistory,
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  listMembers,
  assignMember,
  endPlacement,
};
