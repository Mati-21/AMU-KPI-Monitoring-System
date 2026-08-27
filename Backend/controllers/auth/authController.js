import { prisma  } from '../../config/database.js';
import { logActivity  } from '../../utils/auditLogger.js';
import generateToken from '../../utils/generateToken.js';
import { validationResult  } from 'express-validator';
import bcrypt from 'bcryptjs';

const getPublicProfile = (user) => {
  return {
    Id: user.Id,
    FirstName: user.FirstName,
    FatherName: user.FatherName,
    GrandFatherName: user.GrandFatherName,
    FullName: `${user.FirstName} ${user.FatherName} ${user.GrandFatherName}`,
    Email: user.Email,
    UserName: user.UserName,
    Phone: user.Phone,
    ProfilePicture: user.ProfilePicture,
    CreatedAt: user.CreatedAt
  };
};

const activeRoleInclude = {
  UserRoles: {
    where: {
      IsArchived: false,
      OR: [
        { ToDate: null },
        { ToDate: { gte: new Date() } }
      ],
      Roles: { IsArchived: false }
    },
    include: {
      Roles: {
        include: {
          other_Roles: { select: { Id: true } },
          Roles: { select: { Id: true, RoleName: true, HasExtraMeasures: true } }
        }
      }
    }
  }
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
    .filter((userRole) => userRole?.Roles)
    .sort((left, right) => new Date(right?.CreatedAt || 0).getTime() - new Date(left?.CreatedAt || 0).getTime());

  if (validUserRoles.length === 0) return null;

  const systemAdminRole = validUserRoles.find((userRole) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(userRole?.Roles?.RoleName)));
  return systemAdminRole?.Roles || validUserRoles[0]?.Roles || null;
};

const buildAuthPayload = (user) => {
  const role = selectPrimaryRole(user?.UserRoles) || null;

  return {
    user: {
      ...getPublicProfile(user),
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

    const userExists = await prisma.users.findFirst({
      where: {
        OR: [{ Email }, { UserName }]
      }
    });

    if (userExists && !userExists.IsArchived) {
      return res.status(400).json({ message: 'User with the same email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userPayload = {
      FirstName,
      FatherName,
      GrandFatherName,
      Email,
      UserName,
      Phone,
      password: hashedPassword,
      CreatedBy: req.user?.Id || null,
    };

    let user;

    if (userExists && userExists.IsArchived) {
      user = await prisma.users.update({
        where: { Id: userExists.Id },
        data: {
          ...userPayload,
          IsArchived: false,
        }
      });
    } else {
      user = await prisma.users.create({
        data: userPayload
      });
    }

    const userWithRole = await prisma.users.findUnique({
      where: { Id: user.Id },
      include: activeRoleInclude
    });

    const payload = buildAuthPayload(userWithRole || user);

    if (!req.user) {
      const token = generateToken(user.Id, { roleVersion: payload.role?.PermissionVersion || 0 });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 30, // 30 minutes
      });
    }

    await logActivity({
      userId: req.user?.Id || user.Id,
      action: 'USER_REGISTRATION',
      resource: 'User',
      description: `Created user: ${FirstName} ${FatherName}`,
      ipAddress: req.ip
    });

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

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          { UserName: { equals: loginIdentifier, mode: 'insensitive' } },
          { Email: { equals: loginIdentifier, mode: 'insensitive' } }
        ]
      },
      include: activeRoleInclude
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
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
      maxAge: 1000 * 60 * 30, // 30 minutes
    });

    await logActivity({
      userId: user.Id,
      action: 'LOGIN',
      resource: 'Auth',
      description: `User logged in: ${user.UserName}`,
      ipAddress: req.ip
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
    const userWithRole = await prisma.users.findUnique({
      where: { Id: req.user.Id },
      include: activeRoleInclude
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

const logoutUser = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });

  if (req.user) {
    logActivity({
      userId: req.user.Id,
      action: 'LOGOUT',
      resource: 'Auth',
      description: `User logged out: ${req.user.UserName}`,
      ipAddress: req.ip
    }).catch(err => console.error('Logout logging failed:', err));
  }

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export { 
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
 };
