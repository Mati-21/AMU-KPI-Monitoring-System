const jwt = require('jsonwebtoken');
const { User, UserRole, Role, UserActivityLog, SystemSetting, sequelize } = require('../models');
const { Op } = require('sequelize');

const checkMaintenance = async (user) => {
  const setting = await SystemSetting.findOne({ where: { Key: 'maintenance_mode' } });
  const isMaintenance = setting ? setting.Value === 'true' : false;
  
  if (isMaintenance) {
    const isSystemAdmin = hasSystemAdminRole(user);
    if (!isSystemAdmin) {
      return true; // Is in maintenance and user is not admin
    }
  }
  return false;
};

const trackActivity = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Update User LastActiveAt
    await User.update({ LastActiveAt: new Date() }, { where: { Id: userId } });

    // 2. Upsert Daily Activity Log
    await UserActivityLog.upsert({
      UserId: userId,
      ActivityDate: today,
      LastActiveAt: new Date()
    }, {
      conflictFields: ['UserId', 'ActivityDate']
    });
  } catch (err) {
    console.error('Failed to track user activity:', err);
  }
};

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const permissionKey = (action, resource) => {
  const normalizedAction = normalizeToken(action);
  const normalizedResource = normalizeToken(resource);

  if (!normalizedAction || !normalizedResource) {
    return '';
  }

  return `${normalizedAction}_${normalizedResource}`;
};

const AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS = [
  permissionKey('view', 'Affiliated Office Report'),
  permissionKey('view', 'KPI Reporting'),
  permissionKey('view', 'Other Affiliated Office Reports'),
  permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

const RESOURCE_ALIASES = {
  performance: ['assigned_kpi'],
  assigned_kpi: ['performance'],
};

const expandPermissionAliases = (permission) => {
  const normalized = normalizeToken(permission);
  if (!normalized) {
    return [];
  }

  const match = normalized.match(/^([a-z]+)_(.+)$/);
  if (!match) {
    return [normalized];
  }

  const action = match[1];
  const resource = match[2];
  const resources = [resource, ...(RESOURCE_ALIASES[resource] || [])];

  return [...new Set(resources.map((entry) => `${action}_${entry}`))];
};

const flattenPermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return [];
  }

  const flattened = new Set();

  permissions.forEach((permission) => {
    if (typeof permission === 'string') {
      const normalized = normalizeToken(permission);
      if (normalized) {
        flattened.add(normalized);
      }
      return;
    }

    if (!permission || typeof permission !== 'object') {
      return;
    }

    if (typeof permission.permission === 'string') {
      const normalized = normalizeToken(permission.permission);
      if (normalized) {
        flattened.add(normalized);
      }
    }

    const resource = permission.module || permission.resource || permission.name || permission.label;
    ['view', 'create', 'assign', 'edit', 'delete', 'approve', 'manage'].forEach((action) => {
      if (permission[action]) {
        const key = permissionKey(action, resource);
        if (key) {
          flattened.add(key);
        }
      }
    });
  });

  return [...flattened];
};

const hasPermission = (permissions, requiredPermission) => {
  if (!requiredPermission) return true;

  const flattened = flattenPermissions(permissions);

  // wildcard means everything allowed
  if (Array.isArray(flattened) && flattened.includes('*')) return true;

  const availablePermissions = new Set(flattened.flatMap((permission) => expandPermissionAliases(permission)));
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return requiredPermissions.some((permission) => {
    const normalized = normalizeToken(permission);
    return normalized ? availablePermissions.has(normalized) : false;
  });
};

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  'admin',
  'administrator',
  'system_admin',
  'system_administrator',
  'super_admin',
  'superadministrator',
  'super_administrator',
]);

const hasSystemAdminRole = (user) => {
  if (!user) return false;

  // Prefer checking all active roles when present (more robust than relying on currentRole)
  if (Array.isArray(user.UserRoles) && user.UserRoles.length > 0) {
    return user.UserRoles.some((userRole) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(userRole?.Role?.RoleName || '')));
  }

  const normalizedRoleName = normalizeToken(user?.currentRole?.RoleName || user?.roleName || '');
  return SYSTEM_ADMIN_ROLE_NAMES.has(normalizedRoleName);
};

const isSystemAdminRequest = (req) => {
  return hasSystemAdminRole(req.user);
};

const selectPrimaryRole = (userRoles) => {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return null;

  const validUserRoles = userRoles
    .filter((userRole) => userRole?.Role)
    .sort((left, right) => new Date(right?.CreatedAt || 0).getTime() - new Date(left?.CreatedAt || 0).getTime());

  if (validUserRoles.length === 0) return null;

  const systemAdminRole = validUserRoles.find((userRole) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(userRole?.Role?.RoleName)));
  return systemAdminRole?.Role || validUserRoles[0]?.Role || null;
};

const SYSTEM_ADMIN_FALLBACK_PERMISSIONS = [
  'admin_dashboard',
  permissionKey('manage', 'Users'),
  permissionKey('manage', 'Roles'),
  permissionKey('manage', 'Permissions'),
  permissionKey('view', 'Assigned KPI'),
  permissionKey('view', 'KPI Approvals'),
  permissionKey('create', 'KPI Approvals'),
  permissionKey('view', 'KPI Allocation'),
  ...AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS,
  permissionKey('view', 'User Management'),
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('delete', 'User Management'),
  permissionKey('view', 'Role Management'),
  permissionKey('create', 'Role Management'),
  permissionKey('edit', 'Role Management'),
  permissionKey('delete', 'Role Management'),
  permissionKey('view', 'Configuration'),
  permissionKey('view', 'Alerts & Notifications'),
  permissionKey('view', 'Personal Profile'),
].filter(Boolean);

const getEffectivePermissions = (req) => {
  const rolePermissions = Array.isArray(req.user?.currentRole?.Permissions) ? req.user.currentRole.Permissions : [];

  if (!isSystemAdminRequest(req)) {
    return rolePermissions;
  }

  // System admin: wildcard allows short-circuit checks
  return ['*'];
};

const ADMIN_PERMISSION_KEYS = [
  'admin_dashboard',
  permissionKey('manage', 'Users'),
  permissionKey('manage', 'Roles'),
  permissionKey('manage', 'Permissions'),
  permissionKey('view', 'KPI Approvals'),
  permissionKey('create', 'KPI Approvals'),
  permissionKey('view', 'User Management'),
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('delete', 'User Management'),
  permissionKey('view', 'Role Management'),
  permissionKey('create', 'Role Management'),
  permissionKey('edit', 'Role Management'),
  permissionKey('delete', 'Role Management'),
];

const protect = async (req, res, next) => {
  let token;

  // Prefer cookie auth for browser sessions. If a stale Authorization header exists,
  // we do NOT want it to override a valid httpOnly cookie.
  if (req.cookies && req.cookies.token) {
    try {
      token = req.cookies.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findByPk(decoded.Id, {
        attributes: { exclude: ['password'] },
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
              },
            ],
          },
        ],
      });

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (Array.isArray(req.user.UserRoles) && req.user.UserRoles.length > 0) {
        const activeRole = selectPrimaryRole(req.user.UserRoles);

        console.log(`[AUTH] User ${req.user.Id} has roles:`, req.user.UserRoles.map((ur) => ur?.Role?.RoleName).filter(Boolean));
        console.log(`[AUTH] Active Role:`, activeRole?.RoleName);
        console.log(`[AUTH] Is System Admin:`, hasSystemAdminRole(req.user));

        req.user.currentRole = activeRole;
        req.user.roleName = activeRole?.RoleName || null;
        if (typeof activeRole?.PermissionVersion !== 'undefined') {
          const tokenRoleVersion = typeof decoded.roleVersion !== 'undefined' ? decoded.roleVersion : 0;
          if (tokenRoleVersion !== activeRole.PermissionVersion) {
            // Do not force-logout active sessions when role permissions change.
            // The effective permissions are loaded from the database on every request,
            // so access control will still reflect the latest role permissions.
            req.authStaleRoleVersion = true;
            res.set('X-Role-Permissions-Updated', '1');
          }
        }
      }

      if (await checkMaintenance(req.user)) {
        return res.status(503).json({ message: 'System is under maintenance', maintenance: true });
      }

      trackActivity(req.user.Id);
      next();
      return;
    } catch (error) {
      console.error('Auth error (cookie):', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  // Fallback to Bearer token for API clients
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findByPk(decoded.Id, {
        attributes: { exclude: ['password'] },
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
              },
            ],
          },
        ],
      });

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (Array.isArray(req.user.UserRoles) && req.user.UserRoles.length > 0) {
        const activeRole = selectPrimaryRole(req.user.UserRoles);

        req.user.currentRole = activeRole;
        req.user.roleName = activeRole?.RoleName || null;
        if (typeof activeRole?.PermissionVersion !== 'undefined') {
          const tokenRoleVersion = typeof decoded.roleVersion !== 'undefined' ? decoded.roleVersion : 0;
          if (tokenRoleVersion !== activeRole.PermissionVersion) {
            req.authStaleRoleVersion = true;
            res.set('X-Role-Permissions-Updated', '1');
          }
        }
      }

      if (await checkMaintenance(req.user)) {
        return res.status(503).json({ message: 'System is under maintenance', maintenance: true });
      }

      trackActivity(req.user.Id);
      next();
      return;
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

const admin = (req, res, next) => {
  if (isSystemAdminRequest(req) || hasPermission(getEffectivePermissions(req), ADMIN_PERMISSION_KEYS)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};

const hasModulePermission = (req, moduleName, action = 'view') => {
  if (isSystemAdminRequest(req)) {
    return true;
  }

  const rolePermissions = getEffectivePermissions(req);
  return hasPermission(rolePermissions, permissionKey(action, moduleName));
};

const requireModulePermission =
  (moduleName, action = 'view') =>
  (req, res, next) => {
    if (hasModulePermission(req, moduleName, action)) {
      next();
      return;
    }

    res.status(403).json({ message: `Not authorized for ${action} access on ${moduleName}` });
  };

const requirePermission = (permission) => (req, res, next) => {
  if (isSystemAdminRequest(req)) {
    next();
    return;
  }

  if (hasPermission(getEffectivePermissions(req), permission)) {
    next();
    return;
  }

  res.status(403).json({ message: `Not authorized for ${permission}` });
};

module.exports = { protect, admin, requireModulePermission, hasModulePermission, requirePermission, hasPermission, permissionKey };
