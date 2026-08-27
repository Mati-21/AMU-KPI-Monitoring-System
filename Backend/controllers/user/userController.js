import { prisma  } from '../../config/database.js';
import { logActivity  } from '../../utils/auditLogger.js';
import { hasPermission, permissionKey  } from '../../middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';

const mapUser = (user) => {
  if (!user) return user;
  const mapped = { ...user };
  if (mapped.UserRoles) {
    mapped.UserRoles = mapped.UserRoles.map(ur => {
      const mappedUr = { ...ur };
      if (ur.Roles) {
        mappedUr.Role = { ...ur.Roles };
        delete mappedUr.Roles;
        if (mappedUr.Role.RoleCategories) {
          mappedUr.Role.RoleCategory = mappedUr.Role.RoleCategories;
          delete mappedUr.Role.RoleCategories;
        }
        if (mappedUr.Role.Roles) {
          mappedUr.Role.ParentRole = mappedUr.Role.Roles;
          delete mappedUr.Role.Roles;
        }
      }
      return mappedUr;
    });
  }
  return mapped;
};

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

const userSelectFields = {
  Id: true, FirstName: true, FatherName: true, GrandFatherName: true,
  Email: true, UserName: true, Phone: true, CreatedAt: true, CreatedBy: true, ProfilePicture: true, IsArchived: true
};

const activeRoleInclude = {
  UserRoles: {
    where: {
      IsArchived: false,
      OR: [{ ToDate: null }, { ToDate: { gte: new Date() } }],
    },
    include: {
      Roles: {
        select: {
          Id: true, RoleName: true, RoleCategoryId: true, ParentRoleId: true,
          RoleCategories: { select: { Id: true, CategoryName: true } },
          Roles: { select: { Id: true, RoleName: true } } // ParentRole
        },
      }
    },
    orderBy: { CreatedAt: 'desc' }
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      where: { IsArchived: false },
      select: {
        ...userSelectFields,
        ...activeRoleInclude
      },
      orderBy: { CreatedAt: 'desc' },
    });

    const mappedUsers = users.map(mapUser);

    if (!canManageUsers(req) && canCreateChildOfficeAccounts(req)) {
      const scopedUsers = mappedUsers.filter((user) => {
        const assignments = Array.isArray(user?.UserRoles) ? user.UserRoles : [];
        return isCreatedByCurrentDelegatedUser(req, user, assignments);
      });

      return res.json({ success: true, data: scopedUsers });
    }

    res.json({
      success: true,
      data: mappedUsers,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = String(req.user?.Id || '') === String(id);

    const user = await prisma.users.findUnique({
      where: { Id: id },
      select: {
        ...userSelectFields,
        ...activeRoleInclude
      }
    });

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    const mappedUser = mapUser(user);

    if (!isSelf && !canManageUsers(req) && canCreateChildOfficeAccounts(req)) {
      const assignments = Array.isArray(mappedUser?.UserRoles) ? mappedUser.UserRoles : [];
      if (!isCreatedByCurrentDelegatedUser(req, mappedUser, assignments)) {
        return res.status(403).json({ message: 'Not authorized to view this user.' });
      }
    }

    res.json({
      success: true,
      data: mappedUser,
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

    const user = await prisma.users.findUnique({ where: { Id: id } });

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

    const duplicateEmail = await prisma.users.findFirst({
      where: {
        IsArchived: false,
        Id: { not: id },
        Email: { equals: nextEmail, mode: 'insensitive' }
      },
      select: { Id: true }
    });

    if (duplicateEmail) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    const duplicateUserName = await prisma.users.findFirst({
      where: {
        IsArchived: false,
        Id: { not: id },
        UserName: { equals: nextUserName, mode: 'insensitive' }
      },
      select: { Id: true }
    });

    if (duplicateUserName) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    await prisma.users.update({
      where: { Id: id },
      data: {
        FirstName: nextFirstName,
        FatherName: nextFatherName,
        GrandFatherName: nextGrandFatherName,
        Email: nextEmail,
        Phone: nextPhone,
        UserName: nextUserName,
      }
    });

    const updatedUser = await prisma.users.findUnique({
      where: { Id: id },
      select: {
        ...userSelectFields,
        ...activeRoleInclude
      }
    });

    const mappedUpdatedUser = mapUser(updatedUser);

    await logActivity({
      userId: req.user.Id,
      action: 'UPDATE_USER',
      resource: 'User',
      description: `Updated profile for user: ${mappedUpdatedUser.FirstName} ${mappedUpdatedUser.FatherName} (${mappedUpdatedUser.UserName})`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: mappedUpdatedUser,
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

    const user = await prisma.users.findUnique({ where: { Id: id } });

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    await prisma.users.update({
      where: { Id: id },
      data: { IsArchived: true }
    });

    await prisma.userRoles.updateMany({
      where: {
        UserId: id,
        IsArchived: false,
      },
      data: {
        IsArchived: true,
        ToDate: new Date(),
      }
    });

    await logActivity({
      userId: req.user.Id,
      action: 'DELETE_USER',
      resource: 'User',
      description: `Archived user account: ${user.FirstName} ${user.FatherName} (${user.UserName})`,
      ipAddress: req.ip,
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

    const user = await prisma.users.findUnique({ where: { Id: id } });
    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }


    const hashedPassword = await bcrypt.hash(nextPassword, 10);

    await prisma.users.update({
      where: { Id: id },
      data: { password: hashedPassword }
    });

    await logActivity({
      userId: req.user.Id,
      action: 'RESET_PASSWORD',
      resource: 'User',
      description: `Reset password for user: ${user.FirstName} ${user.FatherName} (${user.UserName})`,
      ipAddress: req.ip,
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

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { id } = req.params;
    const user = await prisma.users.findUnique({ where: { Id: id } });

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(req.user.Id) !== String(id) && !isSystemAdminRequest(req)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.users.update({
      where: { Id: id },
      data: { ProfilePicture: req.file.path }
    });

    await logActivity({
      userId: req.user.Id,
      action: 'UPLOAD_PROFILE_PICTURE',
      resource: 'User',
      description: `Uploaded profile picture for user: ${user.UserName}`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      profilePicture: req.file.path,
      message: 'Profile picture uploaded successfully',
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetUserPassword,
  uploadProfilePicture,
 };
