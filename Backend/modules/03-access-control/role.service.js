import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Roles =====

export const listRoles = async () => notImplemented('listRoles');

export const getRoleById = async (id) => notImplemented('getRoleById');

export const createRole = async (data, actor) => notImplemented('createRole');

export const updateRole = async (id, data, actor) => notImplemented('updateRole');

export const deleteRole = async (id, actor) => notImplemented('deleteRole');

/**
 * Replace a role's permission set with the given codes.
 */
export const syncRolePermissions = async (roleId, permissionCodes, actor) => notImplemented('syncRolePermissions');

// ===== Permissions =====

export const listPermissions = async () => notImplemented('listPermissions');

// ===== Scoped role assignments (OfficePersonRole) =====

export const assignRole = async (officePersonId, { roleId, scopeOfficeId, validFrom, validTo }, actor) => notImplemented('assignRole');

export const revokeRoleAssignment = async (id, actor) => notImplemented('revokeRoleAssignment');

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
