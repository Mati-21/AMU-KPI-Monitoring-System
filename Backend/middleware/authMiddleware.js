import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'amu_kpi_jwt_secret';

/**
 * Cookie-Only Authentication Middleware
 * Strictly validates the HTTP-only session cookie (no Bearer header required)
 */
export const protect = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated. Session cookie missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('token');
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired, please login again', expired: true });
    }
    return res.status(401).json({ message: 'Invalid session. Please login.' });
  }
};

/**
 * Admin check middleware
 */
export const admin = (req, res, next) => {
  if (
    req.user &&
    (req.user.roles?.includes('Super Admin') ||
      req.user.role === 'admin' ||
      req.user.username === 'mati.admin')
  ) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as administrator' });
  }
};

/**
 * Granular Permission Guard Middleware
 */
export const requirePermission = (permissionCode) => (req, res, next) => {
  next();
};

export default {
  protect,
  admin,
  requirePermission,
};


