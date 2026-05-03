const { Op, col, fn, where: sequelizeWhere } = require('sequelize');
const { Role, RoleCategory, UserRole } = require('../models');
const { normalizeRolePermissions } = require('../utils/rolePermissions');
const { hasPermission, permissionKey } = require('../middleware/authMiddleware');

const isSystemAdmin = (roleName) => {
  const normalized = String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return ['admin', 'administrator', 'system_admin', 'system_administrator', 'super_admin', 'superadministrator', 'super_administrator'].includes(
    normalized
  );
};

const countActiveSystemAdminAssignments = async (excludeRoleId = null) => {
  const where = {
    IsArchived: false,
    [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
  };

  if (excludeRoleId) {
    where.RoleId = { [Op.ne]: excludeRoleId };
  }

  return UserRole.count({
    where,
    include: [
      {
        model: Role,
        required: true,
        where: {
          IsArchived: false,
        },
      },
    ],
  }).then(async (count) => {
    if (count === 0) return 0;

    // Count only assignments whose role name maps to system admin aliases.
    const assignments = await UserRole.findAll({
      where,
      include: [
        {
          model: Role,
          required: true,
          where: { IsArchived: false },
          attributes: ['RoleName'],
        },
      ],
      attributes: ['Id'],
    });

    return assignments.filter((assignment) => isSystemAdmin(assignment?.Role?.RoleName)).length;
  });
};

const getCreatorRoleId = (req) => String(req.user?.currentRole?.Id || req.user?.roleId || '');

const canManageAllRoles = (req) => {
  const creatorRoleName = req.user?.currentRole?.RoleName || req.user?.roleName || '';
  if (isSystemAdmin(creatorRoleName)) {
    return true;
  }

  return hasPermission(req.user?.currentRole?.Permissions, [permissionKey('manage', 'Roles'), permissionKey('manage', 'Permissions')]);
};

const isDelegatedRoleCreator = (req) => {
  if (canManageAllRoles(req)) {
    return false;
  }

  return hasPermission(req.user?.currentRole?.Permissions, permissionKey('create', 'Role Management'));
};

const createRole = async (req, res) => {
  try {
    const { RoleCategoryId, RoleName, ParentRoleId, Description, HasExtraMeasures, IsDistributable, Permissions } = req.body;
    const normalizedRoleName = (RoleName || '').trim();
    const creatorRoleName = req.user?.currentRole?.RoleName || req.user?.roleName || '';
    const creatorRoleId = getCreatorRoleId(req);
    const creatorRoleCategoryId = req.user?.currentRole?.RoleCategoryId || null;
    const creatorIsAdmin = isSystemAdmin(creatorRoleName);

    if (!normalizedRoleName) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const duplicate = await Role.findOne({
      where: {
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('RoleName'))), normalizedRoleName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    let resolvedRoleCategoryId = RoleCategoryId || null;

    if (!creatorIsAdmin) {
      resolvedRoleCategoryId = creatorRoleCategoryId;
    }

    if (resolvedRoleCategoryId) {
      const category = await RoleCategory.findByPk(resolvedRoleCategoryId);
      if (!category) {
        return res.status(404).json({ message: 'Role category not found' });
      }
    }

    let resolvedParentRoleId = ParentRoleId || null;

    if (!creatorIsAdmin) {
      if (!creatorRoleId) {
        return res.status(403).json({ message: 'Not authorized to create roles.' });
      }

      if (resolvedParentRoleId && String(resolvedParentRoleId) !== creatorRoleId) {
        return res.status(403).json({ message: 'Delegated role creation is limited to your own parent role.' });
      }

      resolvedParentRoleId = creatorRoleId;
    }

    if (resolvedParentRoleId) {
      const parentRole = await Role.findByPk(resolvedParentRoleId);
      if (!parentRole) {
        return res.status(404).json({ message: 'Parent role not found' });
      }
    }

    const role = await Role.create({
      RoleCategoryId: resolvedRoleCategoryId,
      RoleName: normalizedRoleName,
      ParentRoleId: resolvedParentRoleId,
      Description,
      HasExtraMeasures: HasExtraMeasures || false,
      IsDistributable: IsDistributable ?? true,
      Permissions: normalizeRolePermissions(normalizedRoleName, Permissions),
      PermissionVersion: 1,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const where = { IsArchived: false };

    if (isDelegatedRoleCreator(req)) {
      where.CreatedBy = req.user?.Id;
    }

    const roles = await Role.findAll({
      where,
      include: [
        {
          model: RoleCategory,
          attributes: ['Id', 'CategoryName'],
        },
        {
          model: Role,
          as: 'ParentRole',
          attributes: ['Id', 'RoleName'],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
      include: [
        {
          model: RoleCategory,
          attributes: ['Id', 'CategoryName'],
        },
        {
          model: Role,
          as: 'ParentRole',
          attributes: ['Id', 'RoleName'],
        },
        {
          model: Role,
          as: 'ChildRoles',
          attributes: ['Id', 'RoleName'],
        },
      ],
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (isDelegatedRoleCreator(req) && String(role.CreatedBy || '') !== String(req.user?.Id || '')) {
      return res.status(403).json({ message: 'Not authorized to access this role.' });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { RoleCategoryId, RoleName, ParentRoleId, Description, HasExtraMeasures, IsDistributable, Permissions } = req.body;
    const normalizedRoleName = (RoleName || '').trim();
    const creatorRoleName = req.user?.currentRole?.RoleName || req.user?.roleName || '';
    const creatorRoleId = getCreatorRoleId(req);
    const creatorRoleCategoryId = req.user?.currentRole?.RoleCategoryId || null;
    const creatorIsAdmin = isSystemAdmin(creatorRoleName);

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (!normalizedRoleName) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    if (isDelegatedRoleCreator(req) && String(role.CreatedBy || '') !== String(req.user?.Id || '')) {
      return res.status(403).json({ message: 'Not authorized to update this role.' });
    }

    if (ParentRoleId === id) {
      return res.status(400).json({ message: 'Role cannot be its own parent' });
    }

    const duplicate = await Role.findOne({
      where: {
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('RoleName'))), normalizedRoleName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    if (RoleCategoryId) {
      const category = await RoleCategory.findByPk(RoleCategoryId);
      if (!category) {
        return res.status(404).json({ message: 'Role category not found' });
      }
    }

    let resolvedRoleCategoryId = RoleCategoryId || null;
    let resolvedParentRoleId = ParentRoleId || null;

    if (!creatorIsAdmin && !canManageAllRoles(req)) {
      resolvedRoleCategoryId = creatorRoleCategoryId;

      if (!creatorRoleId) {
        return res.status(403).json({ message: 'Not authorized to update roles.' });
      }

      if (resolvedParentRoleId && String(resolvedParentRoleId) !== creatorRoleId) {
        return res.status(403).json({ message: 'Delegated role updates must keep your role as parent.' });
      }

      resolvedParentRoleId = creatorRoleId;
    }

    const newPermissionVersion = (role.PermissionVersion || 0) + 1;

    await role.update({
      RoleCategoryId: resolvedRoleCategoryId,
      RoleName: normalizedRoleName,
      ParentRoleId: resolvedParentRoleId,
      Description,
      HasExtraMeasures,
      IsDistributable: IsDistributable ?? role.IsDistributable,
      Permissions: normalizeRolePermissions(normalizedRoleName, Permissions),
      PermissionVersion: newPermissionVersion,
    });

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (isSystemAdmin(role.RoleName)) {
      const remainingSystemAdmins = await countActiveSystemAdminAssignments(role.Id);
      if (remainingSystemAdmins < 1) {
        return res.status(400).json({
          message: 'Cannot delete this role because it is the last active System Administrator role assignment.',
        });
      }
    }

    // Keep hierarchy intact by moving direct children one level up.
    // If the deleted role has no parent, children become top-level roles.
    const [reparentedChildren] = await Role.update({ ParentRoleId: role.ParentRoleId || null }, { where: { ParentRoleId: id, IsArchived: false } });

    await role.update({ IsArchived: true });

    res.json({
      success: true,
      message: 'Role archived successfully',
      reparentedChildren,
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
