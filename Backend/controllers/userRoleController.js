const { UserRole, User, Role } = require('../models');
const { Op } = require('sequelize');
const { hasPermission, permissionKey } = require('../middleware/authMiddleware');

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  'admin',
  'administrator',
  'system_admin',
  'system_administrator',
  'super_admin',
  'superadministrator',
  'super_administrator',
]);

const isSystemAdminRequest = (req) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(req.user?.currentRole?.RoleName || req.user?.roleName || ''));

const isSystemAdminRoleName = (roleName) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(roleName));

const countActiveSystemAdminAssignments = async () => {
  const assignments = await UserRole.findAll({
    where: {
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
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

  return assignments.filter((assignment) => isSystemAdminRoleName(assignment?.Role?.RoleName)).length;
};

const STARTER_PERMISSION_SCOPE_SET = new Set(
  [permissionKey('view', 'Sub Unit'), permissionKey('view', 'Affiliated Office Report'), permissionKey('view', 'Personal Profile')].filter(Boolean)
);

const buildStarterPermissionRows = () => {
  const byScope = new Map();

  STARTER_PERMISSION_SCOPE_SET.forEach((key) => {
    const normalized = String(key || '')
      .trim()
      .toLowerCase();
    const match = normalized.match(/^([a-z]+)_(.+)$/);
    if (!match) {
      return;
    }

    const action = match[1];
    const resourceKey = match[2];

    if (!byScope.has(resourceKey)) {
      byScope.set(resourceKey, {
        module: resourceKey
          .split('_')
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
      });
    }

    const row = byScope.get(resourceKey);
    if (row && Object.prototype.hasOwnProperty.call(row, action)) {
      row[action] = true;
    }
  });

  return [...byScope.values()];
};

const assignRoleToUser = async (req, res) => {
  try {
    const { UserId, RoleId, FromDate, ToDate } = req.body;
    const rolePermissions = req.user?.currentRole?.Permissions;
    const isSystemAdmin = isSystemAdminRequest(req);
    const canManageUsers =
      isSystemAdmin ||
      hasPermission(rolePermissions, [
        permissionKey('create', 'User Management'),
        permissionKey('edit', 'User Management'),
        permissionKey('delete', 'User Management'),
        permissionKey('manage', 'Users'),
      ]);
    const canCreateChildOfficeAccounts =
      isSystemAdmin || hasPermission(rolePermissions, [permissionKey('create', 'Child Office Accounts'), permissionKey('create', 'User Management')]);

    if (!canManageUsers && !canCreateChildOfficeAccounts) {
      return res.status(403).json({ message: 'Not authorized to assign roles.' });
    }

    const user = await User.findByPk(UserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = await Role.findByPk(RoleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    const hasRolePermissions = Array.isArray(role.Permissions) && role.Permissions.length > 0;
    if (!hasRolePermissions) {
      await role.update({ Permissions: buildStarterPermissionRows() });
    }

    if (!canManageUsers && canCreateChildOfficeAccounts) {
      const requesterRoleId = String(req.user?.currentRole?.Id || '');
      const targetParentRoleId = String(role.ParentRoleId || '');

      if (!requesterRoleId || targetParentRoleId !== requesterRoleId) {
        return res.status(403).json({ message: 'Delegated account creation is limited to your direct child offices.' });
      }
    }

    const existingRole = await UserRole.findOne({
      where: {
        UserId,
        IsArchived: false,
        [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
      },
    });

    if (existingRole) {
      return res.status(400).json({
        message: 'User already has an active role. End current role first.',
      });
    }

    const userRole = await UserRole.create({
      UserId,
      RoleId,
      FromDate: FromDate || new Date(),
      ToDate,
      CreatedBy: req.user?.Id,
    });

    if (!canManageUsers && canCreateChildOfficeAccounts && !user.CreatedBy) {
      await user.update({ CreatedBy: req.user?.Id || null });
    }

    res.status(201).json({
      success: true,
      data: userRole,
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserCurrentRole = async (req, res) => {
  try {
    const { userId } = req.params;

    const userRole = await UserRole.findOne({
      where: {
        UserId: userId,
        IsArchived: false,
        [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
      },
      include: [
        {
          model: Role,
          include: ['ParentRole'],
        },
        {
          model: User,
          attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName'],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: userRole,
    });
  } catch (error) {
    console.error('Get user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllUserRoles = async (req, res) => {
  try {
    const userRoles = await UserRole.findAll({
      where: { IsArchived: false },
      include: [
        {
          model: User,
          attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName'],
        },
        {
          model: Role,
          attributes: ['Id', 'RoleName'],
          include: ['ParentRole'],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: userRoles,
    });
  } catch (error) {
    console.error('Get user roles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const endUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { ToDate } = req.body;

    const userRole = await UserRole.findByPk(id, {
      include: [{ model: Role, attributes: ['Id', 'RoleName', 'IsArchived'] }],
    });

    if (!userRole) {
      return res.status(404).json({ message: 'User role assignment not found' });
    }

    const targetRoleIsSystemAdmin = isSystemAdminRoleName(userRole?.Role?.RoleName);
    const requestedEndDate = ToDate ? new Date(ToDate) : new Date();
    const endsImmediately = Number.isFinite(requestedEndDate.getTime()) && requestedEndDate.getTime() <= Date.now();

    if (targetRoleIsSystemAdmin && endsImmediately) {
      const activeSystemAdminCount = await countActiveSystemAdminAssignments();
      if (activeSystemAdminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot end this role assignment because this is the last active System Administrator.',
        });
      }
    }

    await userRole.update({
      ToDate: ToDate || new Date(),
    });

    res.json({
      success: true,
      message: 'User role ended successfully',
      data: userRole,
    });
  } catch (error) {
    console.error('End user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    const userRole = await UserRole.findByPk(id, {
      include: [{ model: Role, attributes: ['Id', 'RoleName', 'IsArchived'] }],
    });

    if (!userRole) {
      return res.status(404).json({ message: 'User role assignment not found' });
    }

    const targetRoleIsSystemAdmin = isSystemAdminRoleName(userRole?.Role?.RoleName);
    if (targetRoleIsSystemAdmin) {
      const activeSystemAdminCount = await countActiveSystemAdminAssignments();
      if (activeSystemAdminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot delete this role assignment because this is the last active System Administrator.',
        });
      }
    }

    await userRole.update({ IsArchived: true });

    res.json({
      success: true,
      message: 'User role archived successfully',
    });
  } catch (error) {
    console.error('Delete user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  assignRoleToUser,
  getUserCurrentRole,
  getAllUserRoles,
  endUserRole,
  deleteUserRole,
};
