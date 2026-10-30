import { prisma } from '../../config/database.js';
import { PERMISSION_CATALOG, PERMISSION_CODES, PERMISSIONS, SUPER_ADMIN_PERMISSION, SUPER_ADMIN_ROLE } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn, overlaps, startOfTodayUtc } from '../../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseDate, parseUuid, requireString } from '../../utils/validation.js';

/**
 * Module 03 — Roles, permission sets and office-scoped role assignments.
 *
 * Roles are named after the access they give (e.g. "College Leadership"), not after job titles:
 * a Position (Module 02) says what job someone holds, a Role says what they may do in the system.
 *
 * Anti-escalation: a non-Super-Admin can only grant permissions they hold themselves, within their own scope,
 * and only a Super Admin can grant or modify anything that includes the '*' wildcard.
 */

const DESCRIPTIONS = new Map(PERMISSION_CATALOG.entries.map((entry) => [entry.code, entry.description]));
DESCRIPTIONS.set(SUPER_ADMIN_PERMISSION, PERMISSION_CATALOG.superAdmin.description);

const OFFICE_REF_SELECT = { id: true, name: true, code: true };

// An assignment is in force when its own window and its placement's tenure both include today
const activeAssignmentWhere = () => ({ ...activeOn('validFrom', 'validTo'), officePerson: activeOn('startDate', 'endDate') });

const isSuperAdminRole = (role) => role.isSystem;
const roleCodes = (role) => role.permissions.map((link) => link.permission.code).sort();

const getRoleOrThrow = async (id) => {
  const role = await prisma.role.findUnique({
    where: { id: parseUuid(id, 'id') },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw notFound('Role not found');
  return role;
};

const assertNameAvailable = async (name, exceptRoleId) => {
  const existing = await prisma.role.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (existing && existing.id !== exceptRoleId) throw conflict(`Role "${existing.name}" already exists`);
};

/**
 * Validate a permission code list: array of known codes, de-duplicated.
 */
const parsePermissionCodes = (codes) => {
  if (!Array.isArray(codes) || codes.some((code) => typeof code !== 'string')) {
    throw badRequest('permissionCodes must be an array of permission codes');
  }
  const unique = [...new Set(codes.map((code) => code.trim()))];
  const unknown = unique.filter((code) => !PERMISSION_CODES.includes(code));
  if (unknown.length > 0) throw badRequest(`Unknown permission code(s): ${unknown.join(', ')}`, { unknown });
  return unique;
};

/**
 * The actor may only put permissions into a role that they hold themselves; '*' is Super Admin only.
 */
const assertCanGrantCodes = async (actor, codes) => {
  if (actor.access.isSuperAdmin) return;
  if (codes.includes(SUPER_ADMIN_PERMISSION)) throw forbidden('Only a Super Admin can grant the * permission');
  const notHeld = [];
  for (const code of codes) if (!(await actor.access.can(code))) notHeld.push(code);
  if (notHeld.length > 0) throw forbidden(`You cannot grant permissions you do not hold: ${notHeld.join(', ')}`, { notHeld });
};

/**
 * Authority to assign or revoke a role within a scope: role:assign plus every permission of the role, in that scope.
 * scopeOfficeId = null means university-wide, which needs university-wide authority.
 */
const assertCanDelegate = async (actor, role, scopeOfficeId) => {
  if (actor.access.isSuperAdmin) return;
  const codes = roleCodes(role);
  if (codes.includes(SUPER_ADMIN_PERMISSION)) throw forbidden('Only a Super Admin can assign or revoke roles that include the * permission');

  const holds = (code) => (scopeOfficeId ? actor.access.can(code, scopeOfficeId) : actor.access.canGlobally(code));
  if (!(await holds(PERMISSIONS.ROLE_ASSIGN))) {
    throw forbidden(scopeOfficeId ? 'This office is outside your role:assign scope' : 'University-wide assignments need university-wide role:assign');
  }
  const notHeld = [];
  for (const code of codes) if (!(await holds(code))) notHeld.push(code);
  if (notHeld.length > 0) {
    throw forbidden(`You cannot delegate permissions you do not hold in this scope: ${notHeld.join(', ')}`, { notHeld });
  }
};

const formatRole = (role, activeAssignments) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissions: roleCodes(role).map((code) => ({ code, description: DESCRIPTIONS.get(code) || null })),
  activeAssignments,
});

// ===== Roles =====

export const listRoles = async () => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { permissions: true, officePersonRoles: { where: activeAssignmentWhere() } } } },
  });
  return roles.map(({ _count, ...role }) => ({
    ...role,
    permissionCount: _count.permissions,
    activeAssignments: _count.officePersonRoles,
  }));
};

export const getRoleById = async (id) => {
  const role = await getRoleOrThrow(id);
  const activeAssignments = await prisma.officePersonRole.count({ where: { roleId: role.id, ...activeAssignmentWhere() } });
  return formatRole(role, activeAssignments);
};

/**
 * Create a role, optionally with its initial permission set.
 */
export const createRole = async ({ name, description, permissionCodes } = {}, actor) => {
  const cleanName = requireString(name, 'name');
  await assertNameAvailable(cleanName);
  const codes = permissionCodes === undefined ? [] : parsePermissionCodes(permissionCodes);
  await assertCanGrantCodes(actor, codes);

  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true } });
  const role = await prisma.role.create({
    data: {
      name: cleanName,
      description: optionalString(description, 'description') ?? null,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });

  await auditAction(actor, { action: 'ROLE_CREATED', entityType: 'role', entityId: role.id, newValues: { ...role, permissionCodes: codes } });
  return getRoleById(role.id);
};

/**
 * Rename or re-describe a role. The Super Admin role cannot be renamed.
 */
export const updateRole = async (id, { name, description } = {}, actor) => {
  const role = await getRoleOrThrow(id);
  const update = {};

  if (name !== undefined) {
    const cleanName = requireString(name, 'name');
    if (cleanName !== role.name) {
      if (isSuperAdminRole(role)) throw forbidden(`The ${SUPER_ADMIN_ROLE} role cannot be renamed`);
      await assertNameAvailable(cleanName, role.id);
      update.name = cleanName;
    }
  }
  if (description !== undefined) update.description = optionalString(description, 'description');
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const updated = await prisma.role.update({ where: { id: role.id }, data: update });
  await auditAction(actor, {
    action: 'ROLE_UPDATED',
    entityType: 'role',
    entityId: role.id,
    oldValues: { name: role.name, description: role.description },
    newValues: { name: updated.name, description: updated.description },
  });
  return getRoleById(role.id);
};

/**
 * Delete a role. Refused for the Super Admin role and while the role has assignments in force;
 * expired assignments are removed with it (the audit trail keeps their history).
 */
export const deleteRole = async (id, actor) => {
  const role = await getRoleOrThrow(id);
  if (isSuperAdminRole(role)) throw forbidden(`The ${SUPER_ADMIN_ROLE} role cannot be deleted`);

  const active = await prisma.officePersonRole.count({ where: { roleId: role.id, ...activeAssignmentWhere() } });
  if (active > 0) throw conflict(`Role "${role.name}" is assigned to ${active} active member(s); revoke those assignments first`);

  await prisma.$transaction([prisma.officePersonRole.deleteMany({ where: { roleId: role.id } }), prisma.role.delete({ where: { id: role.id } })]);
  await auditAction(actor, {
    action: 'ROLE_DELETED',
    entityType: 'role',
    entityId: role.id,
    oldValues: { name: role.name, description: role.description, permissionCodes: roleCodes(role) },
  });
};

/**
 * Replace the role's permission set with exactly `permissionCodes`.
 */
export const syncRolePermissions = async (roleId, permissionCodes, actor) => {
  const role = await getRoleOrThrow(roleId);
  const codes = parsePermissionCodes(permissionCodes);
  const before = roleCodes(role);

  if (isSuperAdminRole(role)) {
    if (!actor.access.isSuperAdmin) throw forbidden(`Only a Super Admin can change the ${SUPER_ADMIN_ROLE} role`);
    if (!codes.includes(SUPER_ADMIN_PERMISSION)) throw badRequest(`The ${SUPER_ADMIN_ROLE} role must keep the * permission`);
  }
  // Only newly added codes need checking: removing a permission never escalates
  await assertCanGrantCodes(actor, codes.filter((code) => !before.includes(code)));

  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  if (permissions.length !== codes.length) {
    throw conflict('Some permission codes are not in the database yet; run npm run seed:permissions');
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) }),
  ]);

  await auditAction(actor, {
    action: 'ROLE_PERMISSIONS_SYNCED',
    entityType: 'role',
    entityId: role.id,
    oldValues: { permissionCodes: before },
    newValues: { permissionCodes: [...codes].sort() },
  });
  return getRoleById(role.id);
};

// ===== Permission catalog =====

/**
 * The catalog from config/permissions.json grouped by module and resource, with database ids.
 */
export const listPermissions = async () => {
  const rows = await prisma.permission.findMany({ select: { id: true, code: true } });
  const ids = new Map(rows.map((row) => [row.code, row.id]));

  return {
    superAdmin: { ...PERMISSION_CATALOG.superAdmin, id: ids.get(SUPER_ADMIN_PERMISSION) ?? null },
    modules: PERMISSION_CATALOG.modules.map((module) => ({
      module: module.module,
      name: module.name,
      resources: module.resources.map((resource) => ({
        resource: resource.resource,
        label: resource.label,
        permissions: resource.permissions.map(({ action, description }) => {
          const code = `${resource.resource}:${action}`;
          return { id: ids.get(code) ?? null, code, action, description };
        }),
      })),
    })),
  };
};

// ===== Scoped role assignments (OfficePersonRole) =====

const ASSIGNMENT_INCLUDE = {
  role: { select: { id: true, name: true } },
  scopeOffice: { select: OFFICE_REF_SELECT },
  officePerson: {
    select: {
      id: true,
      person: { select: { id: true, firstName: true, middleName: true, lastName: true } },
      office: { select: OFFICE_REF_SELECT },
      position: { select: { id: true, title: true } },
    },
  },
};

const formatAssignment = ({ officePerson, ...assignment }) => {
  const { person, ...placement } = officePerson;
  return {
    ...assignment,
    scope: assignment.scopeOffice ? 'office' : 'university',
    placement: { ...placement, person: { id: person.id, fullName: [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') } },
  };
};

/**
 * Grant a role to an office placement.
 * - scopeOfficeId omitted -> the placement's own office; null -> university-wide; otherwise that office (and below)
 * - validFrom defaults to today; validTo optional
 */
export const assignRole = async (officePersonId, { roleId, scopeOfficeId, validFrom, validTo } = {}, actor) => {
  const placement = await prisma.officePerson.findUnique({ where: { id: officePersonId } });
  if (!placement) throw notFound('Office placement not found');
  if (placement.endDate && placement.endDate < startOfTodayUtc()) throw badRequest('This office placement has already ended');

  const role = await getRoleOrThrow(parseUuid(roleId, 'roleId'));

  let scope = placement.officeId;
  if (scopeOfficeId === null) scope = null;
  else if (scopeOfficeId !== undefined) {
    const office = await prisma.office.findUnique({ where: { id: scopeOfficeId } }).catch(() => null);
    if (!office) throw badRequest('Scope office not found');
    if (!office.isActive) throw badRequest(`Scope office "${office.name}" is inactive`);
    scope = office.id;
  }

  const start = parseDate(validFrom, 'validFrom', { required: false }) ?? startOfTodayUtc();
  const end = parseDate(validTo, 'validTo', { required: false });
  if (end && end < start) throw badRequest('validTo must be on or after validFrom');

  await assertCanDelegate(actor, role, scope);

  const duplicate = await prisma.officePersonRole.findFirst({
    where: { officePersonId, roleId: role.id, scopeOfficeId: scope, ...overlaps('validFrom', 'validTo', start, end) },
  });
  if (duplicate) throw conflict(`This member already has "${role.name}" in that scope for an overlapping period`);

  const assignment = await prisma.officePersonRole.create({
    data: { officePersonId, roleId: role.id, scopeOfficeId: scope, validFrom: start, validTo: end },
    include: ASSIGNMENT_INCLUDE,
  });
  await auditAction(actor, {
    action: 'ROLE_ASSIGNED',
    entityType: 'office_person_role',
    entityId: assignment.id,
    newValues: { officePersonId, roleId: role.id, roleName: role.name, scopeOfficeId: scope, validFrom: start, validTo: end },
  });
  return formatAssignment(assignment);
};

/**
 * Remove a role assignment. The last active Super Admin assignment cannot be removed (prevents lock-out).
 */
export const revokeRoleAssignment = async (id, actor) => {
  const assignment = await prisma.officePersonRole.findUnique({
    where: { id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!assignment) throw notFound('Role assignment not found');

  await assertCanDelegate(actor, assignment.role, assignment.scopeOfficeId);

  if (isSuperAdminRole(assignment.role)) {
    const otherSuperAdmins = await prisma.officePersonRole.count({
      where: { roleId: assignment.roleId, id: { not: assignment.id }, ...activeAssignmentWhere() },
    });
    if (otherSuperAdmins === 0) throw conflict(`Cannot revoke the last active ${SUPER_ADMIN_ROLE} assignment`);
  }

  await prisma.officePersonRole.delete({ where: { id } });
  const { role, ...rest } = assignment;
  await auditAction(actor, {
    action: 'ROLE_REVOKED',
    entityType: 'office_person_role',
    entityId: id,
    oldValues: { ...rest, roleName: role.name },
  });
};

export default {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  syncRolePermissions,
  listPermissions,
  assignRole,
  revokeRoleAssignment,
};
