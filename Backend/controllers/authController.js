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
    },
  ],
};

const buildAuthPayload = (userWithRole) => {
  const role = userWithRole?.UserRoles?.[0]?.Role || null;

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
    if (userExists) {
      return res.status(400).json({ message: 'User with the same email or username already exists' });
    }

    const user = await User.create({
      FirstName,
      FatherName,
      GrandFatherName,
      Email,
      UserName,
      Phone,
      password,
    });

    const userWithRole = await User.findByPk(user.Id, {
      include: [activeRoleInclude],
    });

    const payload = buildAuthPayload(userWithRole || user);

    res.status(201).json({
      success: true,
      user: payload.user,
      role: payload.role,
      token: generateToken(user.Id),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { UserName, password } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [{ UserName }, { Email: UserName }],
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

    res.json({
      success: true,
      user: payload.user,
      role: payload.role,
      token: generateToken(user.Id),
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
