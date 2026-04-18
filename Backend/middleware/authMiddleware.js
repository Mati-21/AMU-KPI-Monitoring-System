const jwt = require('jsonwebtoken');
const { User, UserRole, Role } = require('../models');
const { Op } = require('sequelize');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user with their current role
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

      // Add role to user object for easy access
      if (req.user.UserRoles && req.user.UserRoles.length > 0) {
        req.user.currentRole = req.user.UserRoles[0].Role;
        req.user.roleName = req.user.currentRole.RoleName;
      }

      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  // Check if user has System Administrator role
  const isAdmin = req.user?.currentRole?.RoleName === 'System Administrator' || req.user?.roleName === 'System Administrator';

  if (isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};

const hasModulePermission = (req, moduleName, action = 'view') => {
  const isAdmin = req.user?.currentRole?.RoleName === 'System Administrator' || req.user?.roleName === 'System Administrator';

  if (isAdmin) return true;

  const rolePermissions = req.user?.currentRole?.Permissions;
  if (!Array.isArray(rolePermissions)) return false;

  const modulePermission = rolePermissions.find(
    (permission) =>
      String(permission?.module || '')
        .trim()
        .toLowerCase() === String(moduleName).trim().toLowerCase()
  );

  if (!modulePermission) return false;
  return Boolean(modulePermission[action]);
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

module.exports = { protect, admin, requireModulePermission, hasModulePermission };
