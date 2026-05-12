const { Op, col, fn, where: sequelizeWhere } = require('sequelize');
const { User, UserRole, Role, RoleCategory } = require('../models');
const { logActivity } = require('../utils/auditLogger');
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

const canManageUsers = (req) =>
  isSystemAdminRequest(req) ||
  hasPermission(req.user?.currentRole?.Permissions, [
    permissionKey('create', 'User Management'),
    permissionKey('edit', 'User Management'),
    permissionKey('delete', 'User Management'),
    permissionKey('manage', 'Users'),
  ]);

const canCreateChildOfficeAccounts = (req) =>
  hasPermission(req.user?.currentRole?.Permissions, [permissionKey('create', 'Child Office Accounts'), permissionKey('create', 'User Management')]);

const isCreatedByCurrentDelegatedUser = (req, userRecord = null, assignments = []) => {
  const requesterUserId = String(req.user?.Id || '');
  if (!requesterUserId) return false;

  if (String(userRecord?.CreatedBy || '') === requesterUserId) {
    return true;
  }

  return assignments.some((assignment) => String(assignment?.CreatedBy || '') === requesterUserId);
};

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { IsArchived: false },
      attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName', 'Phone', 'CreatedAt', 'CreatedBy'],
      include: [
        {
          model: UserRole,
          where: {
            IsArchived: false,
            [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
          },
          required: false,
          include: [
            {
              model: Role,
              where: { IsArchived: false },
              required: false,
              attributes: ['Id', 'RoleName', 'RoleCategoryId', 'ParentRoleId'],
              include: [
                {
                  model: RoleCategory,
                  attributes: ['Id', 'CategoryName'],
                  required: false,
                },
              ],
            },
          ],
          order: [['CreatedAt', 'DESC']],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    if (!canManageUsers(req) && canCreateChildOfficeAccounts(req)) {
      const scopedUsers = users.filter((user) => {
        const assignments = Array.isArray(user?.UserRoles) ? user.UserRoles : [];
        return isCreatedByCurrentDelegatedUser(req, user, assignments);
      });

      return res.json({ success: true, data: scopedUsers });
    }

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName', 'Phone', 'CreatedAt', 'CreatedBy', 'IsArchived'],
      include: [
        {
          model: UserRole,
          where: {
            IsArchived: false,
            [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
          },
          required: false,
          include: [
            {
              model: Role,
              where: { IsArchived: false },
              required: false,
              attributes: ['Id', 'RoleName', 'RoleCategoryId', 'ParentRoleId'],
              include: [
                {
                  model: RoleCategory,
                  attributes: ['Id', 'CategoryName'],
                  required: false,
                },
              ],
            },
          ],
          order: [['CreatedAt', 'DESC']],
        },
      ],
    });

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!canManageUsers(req) && canCreateChildOfficeAccounts(req)) {
      const assignments = Array.isArray(user?.UserRoles) ? user.UserRoles : [];
      if (!isCreatedByCurrentDelegatedUser(req, user, assignments)) {
        return res.status(403).json({ message: 'Not authorized to view this user.' });
      }
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = String(req.user?.Id || '') === String(id);

    if (!isSelf && !canManageUsers(req)) {
      return res.status(403).json({ message: 'Not authorized to update this user.' });
    }

    const user = await User.findByPk(id);

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    const nextFirstName = String(req.body?.FirstName ?? req.body?.firstName ?? user.FirstName).trim();
    const nextFatherName = String(req.body?.FatherName ?? req.body?.fatherName ?? user.FatherName).trim();
    const nextGrandFatherName = String(req.body?.GrandFatherName ?? req.body?.grandFatherName ?? user.GrandFatherName).trim();
    const nextEmail = String(req.body?.Email ?? req.body?.email ?? user.Email).trim();
    const nextPhone = String(req.body?.Phone ?? req.body?.phone ?? user.Phone).trim();
    const nextUserName = String(req.body?.UserName ?? req.body?.userName ?? user.UserName).trim();

    if (!nextFirstName || !nextFatherName || !nextGrandFatherName || !nextEmail || !nextPhone || !nextUserName) {
      return res.status(400).json({
        message: 'First name, father name, grandfather name, email, phone, and username are required.',
      });
    }

    const duplicateEmail = await User.findOne({
      where: {
        IsArchived: false,
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', col('Email')), nextEmail.toLowerCase())],
      },
      attributes: ['Id'],
    });

    if (duplicateEmail) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    const duplicateUserName = await User.findOne({
      where: {
        IsArchived: false,
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', col('UserName')), nextUserName.toLowerCase())],
      },
      attributes: ['Id'],
    });

    if (duplicateUserName) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    await user.update({
      FirstName: nextFirstName,
      FatherName: nextFatherName,
      GrandFatherName: nextGrandFatherName,
      Email: nextEmail,
      Phone: nextPhone,
      UserName: nextUserName,
    });

    const updatedUser = await User.findByPk(id, {
      attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName', 'Phone', 'CreatedAt', 'CreatedBy', 'IsArchived'],
      include: [
        {
          model: UserRole,
          where: {
            IsArchived: false,
            [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
          },
          required: false,
          include: [
            {
              model: Role,
              where: { IsArchived: false },
              required: false,
              attributes: ['Id', 'RoleName', 'RoleCategoryId', 'ParentRoleId'],
              include: [
                {
                  model: RoleCategory,
                  attributes: ['Id', 'CategoryName'],
                  required: false,
                },
              ],
            },
          ],
          order: [['CreatedAt', 'DESC']],
        },
      ],
    });

    await logActivity({
      userId: req.user.Id,
      action: 'UPDATE_USER',
      resource: 'User',
      description: `Updated profile for user: ${updatedUser.FirstName} ${updatedUser.FatherName} (${updatedUser.UserName})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.user?.Id) === String(id)) {
      return res.status(400).json({ message: 'You cannot archive your own account.' });
    }

    const user = await User.findByPk(id);

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ IsArchived: true });

    await UserRole.update(
      {
        IsArchived: true,
        ToDate: new Date(),
      },
      {
        where: {
          UserId: id,
          IsArchived: false,
        },
      }
    );

    await logActivity({
      userId: req.user.Id,
      action: 'DELETE_USER',
      resource: 'User',
      description: `Archived user account: ${user.FirstName} ${user.FatherName} (${user.UserName})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'User archived successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, newPassword } = req.body;

    const nextPassword = String(newPassword || password || '').trim();
    if (!nextPassword || nextPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findByPk(id);
    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = nextPassword;
    await user.save();

    await logActivity({
      userId: req.user.Id,
      action: 'RESET_PASSWORD',
      resource: 'User',
      description: `Reset password for user: ${user.FirstName} ${user.FatherName} (${user.UserName})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'User password reset successfully.',
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetUserPassword,
};
