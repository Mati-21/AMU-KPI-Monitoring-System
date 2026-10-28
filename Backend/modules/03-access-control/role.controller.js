import * as roleService from './role.service.js';
import { getPermissionCodes } from './access.service.js';
import { loadAccess } from '../../middleware/authMiddleware.js';
import { actorOf } from '../../utils/requestContext.js';
import { badRequest } from '../../utils/httpError.js';

export const listRoles = async (req, res) => {
  const roles = await roleService.listRoles();
  res.json({ status: 'success', data: roles });
};

export const getRoleById = async (req, res) => {
  const role = await roleService.getRoleById(req.params.id);
  res.json({ status: 'success', data: role });
};

export const createRole = async (req, res) => {
  const role = await roleService.createRole(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: role });
};

export const updateRole = async (req, res) => {
  const role = await roleService.updateRole(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: role });
};

export const deleteRole = async (req, res) => {
  await roleService.deleteRole(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Role deleted' });
};

export const syncRolePermissions = async (req, res) => {
  const role = await roleService.syncRolePermissions(req.params.id, req.body?.permissionCodes, actorOf(req));
  res.json({ status: 'success', data: role });
};

export const listPermissions = async (req, res) => {
  const permissions = await roleService.listPermissions();
  res.json({ status: 'success', data: permissions });
};

export const assignRole = async (req, res) => {
  const assignment = await roleService.assignRole(req.params.officePersonId, req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: assignment });
};

export const revokeRoleAssignment = async (req, res) => {
  await roleService.revokeRoleAssignment(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Role assignment revoked' });
};

/**
 * Does the current user hold `permission`, optionally within the scope of `officeId`?
 */
export const checkPermission = async (req, res) => {
  const { permission, officeId } = req.query;
  if (!permission) throw badRequest('permission query parameter is required');

  const access = await loadAccess(req);
  const allowed = await access.can(String(permission), officeId ? String(officeId) : undefined);
  res.json({
    status: 'success',
    data: { permission, officeId: officeId || null, allowed, heldPermissions: getPermissionCodes(access.grants) },
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
  checkPermission,
};
