import { prisma  } from '../../config/database.js';
import { logActivity  } from '../../utils/auditLogger.js';
import { normalizeRolePermissions  } from '../../utils/rolePermissions.js';
import { hasPermission, permissionKey  } from '../../middleware/authMiddleware.js';

const mapRole = (role) => {
  if (!role) return role;
  const mapped = { ...role };
  if (mapped.RoleCategories) {
    mapped.RoleCategory = mapped.RoleCategories;
    delete mapped.RoleCategories;
  }
  if (mapped.Roles) {
    mapped.ParentRole = mapped.Roles;
    delete mapped.Roles;
  }
  if (mapped.other_Roles) {
    mapped.ChildRoles = mapped.other_Roles;
    delete mapped.other_Roles;
  }
  return mapped;
};

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
    OR: [{ ToDate: null }, { ToDate: { gte: new Date() } }],
    Roles: {
      IsArchived: false
    }
  };

  if (excludeRoleId) {
    where.RoleId = { not: excludeRoleId };
  }

  const assignments = await prisma.userRoles.findMany({
    where,
    select: {
      Id: true,
      Roles: {
        select: { RoleName: true }
      }
    }
  });

  return assignments.filter((assignment) => isSystemAdmin(assignment?.Roles?.RoleName)).length;
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

    const duplicate = await prisma.roles.findFirst({
      where: {
        RoleName: { equals: normalizedRoleName, mode: 'insensitive' }
      }
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    let resolvedRoleCategoryId = RoleCategoryId || null;

    if (!creatorIsAdmin) {
      resolvedRoleCategoryId = creatorRoleCategoryId;
    }

    if (resolvedRoleCategoryId) {
      const category = await prisma.roleCategories.findUnique({ where: { Id: resolvedRoleCategoryId } });
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
      const parentRole = await prisma.roles.findUnique({ where: { Id: resolvedParentRoleId } });
      if (!parentRole) {
        return res.status(404).json({ message: 'Parent role not found' });
      }
    }

    const role = await prisma.roles.create({
      data: {
        RoleCategoryId: resolvedRoleCategoryId,
        RoleName: normalizedRoleName,
        ParentRoleId: resolvedParentRoleId,
        Description,
        HasExtraMeasures: HasExtraMeasures || false,
        IsDistributable: IsDistributable ?? true,
        Permissions: normalizeRolePermissions(normalizedRoleName, Permissions) || [],
        PermissionVersion: 1,
        CreatedBy: req.user?.Id,
      }
    });

    await logActivity({
      userId: req.user.Id,
      action: 'CREATE_ROLE',
      resource: 'Role',
      description: `Created new role: ${role.RoleName}`,
      ipAddress: req.ip
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

    const roles = await prisma.roles.findMany({
      where,
      include: {
        RoleCategories: { select: { Id: true, CategoryName: true } },
        Roles: { select: { Id: true, RoleName: true } } // ParentRole
      },
      orderBy: { CreatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: roles.map(mapRole),
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.roles.findUnique({
      where: { Id: id },
      include: {
        RoleCategories: { select: { Id: true, CategoryName: true } },
        Roles: { select: { Id: true, RoleName: true } }, // ParentRole
        other_Roles: { select: { Id: true, RoleName: true } } // ChildRoles
      },
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (isDelegatedRoleCreator(req) && String(role.CreatedBy || '') !== String(req.user?.Id || '')) {
      return res.status(403).json({ message: 'Not authorized to access this role.' });
    }

    res.json({
      success: true,
      data: mapRole(role),
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

    const role = await prisma.roles.findUnique({ where: { Id: id } });

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

    const duplicate = await prisma.roles.findFirst({
      where: {
        Id: { not: id },
        RoleName: { equals: normalizedRoleName, mode: 'insensitive' }
      }
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    if (RoleCategoryId) {
      const category = await prisma.roleCategories.findUnique({ where: { Id: RoleCategoryId } });
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

    const updatedRole = await prisma.roles.update({
      where: { Id: id },
      data: {
        RoleCategoryId: resolvedRoleCategoryId,
        RoleName: normalizedRoleName,
        ParentRoleId: resolvedParentRoleId,
        Description,
        HasExtraMeasures,
        IsDistributable: IsDistributable ?? role.IsDistributable,
        Permissions: normalizeRolePermissions(normalizedRoleName, Permissions) || [],
        PermissionVersion: newPermissionVersion,
      }
    });

    res.json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.roles.findUnique({ where: { Id: id } });

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

    const reparentedChildren = await prisma.roles.updateMany({
      where: { ParentRoleId: id, IsArchived: false },
      data: { ParentRoleId: role.ParentRoleId || null }
    });

    await prisma.roles.update({
      where: { Id: id },
      data: { IsArchived: true }
    });

    await logActivity({
      userId: req.user.Id,
      action: 'DELETE_ROLE',
      resource: 'Role',
      description: `Archived role: ${role.RoleName}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Role archived successfully',
      reparentedChildren: [reparentedChildren.count],
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
 };
