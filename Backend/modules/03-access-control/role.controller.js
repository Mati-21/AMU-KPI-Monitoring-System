import * as roleService from './role.service.js';

export const getRoles = async (req, res, next) => {
  try {
    const roles = await roleService.getRoles();
    res.json({ status: 'success', data: roles });
  } catch (error) {
    next(error);
  }
};

export const getRoleById = async (req, res, next) => {
  try {
    const role = await roleService.getRoleById(req.params.id);
    res.json({ status: 'success', data: role });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Role creation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Role update ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Role delete ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const getPermissions = async (req, res, next) => {
  try {
    const permissions = await roleService.getPermissions();
    res.json({ status: 'success', data: permissions });
  } catch (error) {
    next(error);
  }
};

export const createPermission = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Permission creation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const assignPermissions = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Assign permissions ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const assignScopedRole = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Assign scoped role ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const revokeScopedRole = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Revoke scoped role ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  createPermission,
  assignPermissions,
  assignScopedRole,
  revokeScopedRole,
};
