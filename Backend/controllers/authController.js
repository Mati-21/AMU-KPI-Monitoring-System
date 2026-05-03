const { User, UserRole, Role } = require('../models');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const activeRoleInclude = {
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
      include: [
        {
          model: Role,
          as: 'ParentRole',
          attributes: ['Id', 'RoleName', 'HasExtraMeasures'],
          required: false,
        },
      ],
    },
  ],
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

const selectPrimaryRole = (userRoles) => {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return null;

  const validUserRoles = userRoles
    .filter((userRole) => userRole?.Role)
    .sort((left, right) => new Date(right?.CreatedAt || 0).getTime() - new Date(left?.CreatedAt || 0).getTime());

  if (validUserRoles.length === 0) return null;

  const systemAdminRole = validUserRoles.find((userRole) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(userRole?.Role?.RoleName)));
  return systemAdminRole?.Role || validUserRoles[0]?.Role || null;
};

const buildAuthPayload = (userWithRole) => {
  const role = selectPrimaryRole(userWithRole?.UserRoles) || null;

  return {
    user: {
      ...userWithRole.getPublicProfile(),
      roleName: role?.RoleName || null,
      role: role?.RoleName || null,
    },
    role,
  };
};

const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { FirstName, FatherName, GrandFatherName, Email, UserName, Phone, password } = req.body;

    const userExists = await User.findOne({ where: { [Op.or]: [{ Email }, { UserName }] } });
    if (userExists && !userExists.IsArchived) {
      return res.status(400).json({ message: 'User with the same email or username already exists' });
    }

    const userPayload = {
      FirstName,
      FatherName,
      GrandFatherName,
      Email,
      UserName,
      Phone,
      password,
      CreatedBy: req.user?.Id || null,
    };

    let user;

    if (userExists && userExists.IsArchived) {
      await userExists.update({
        ...userPayload,
        IsArchived: false,
      });
      user = userExists;
    } else {
      user = await User.create(userPayload);
    }

    const userWithRole = await User.findByPk(user.Id, {
      include: [activeRoleInclude],
    });

    const payload = buildAuthPayload(userWithRole || user);

    // NOTE: /auth/register is used by admins to create other users.
    // Do not overwrite the creator's (admin) session cookie by logging in as the new user.
    // If in the future you allow public self-registration (without protect middleware),
    // you can set the cookie only when req.user is not present.
    if (!req.user) {
      const token = generateToken(user.Id, { roleVersion: payload.role?.PermissionVersion || 0 });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24, // 1 day
      });
    }

    res.status(201).json({
      success: true,
      user: payload.user,
      role: payload.role,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { UserName, password } = req.body;

    const loginIdentifier = String(UserName || '').trim();

    const user = await User.findOne({
      where: {
        [Op.or]: [{ UserName: { [Op.iLike]: loginIdentifier } }, { Email: { [Op.iLike]: loginIdentifier } }],
      },
      include: [activeRoleInclude],
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    if (user.IsArchived) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const payload = buildAuthPayload(user);

    const token = generateToken(user.Id, { roleVersion: payload.role?.PermissionVersion || 0 });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

    res.json({
      success: true,
      user: payload.user,
      role: payload.role,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const userWithRole = await User.findByPk(req.user.Id, {
      include: [activeRoleInclude],
    });

    if (!userWithRole) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = buildAuthPayload(userWithRole);

    res.json({
      success: true,
      user: payload.user,
      role: payload.role,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
};
