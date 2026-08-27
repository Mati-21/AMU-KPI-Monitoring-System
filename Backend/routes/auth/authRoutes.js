import express from 'express';
import { body  } from 'express-validator';
import { registerUser, loginUser, logoutUser, getCurrentUser  } from '../../controllers/auth/authController.js';
import { protect, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.post(
  '/register',
  protect,
  requirePermission([
    permissionKey('create', 'User Management'),
    permissionKey('edit', 'User Management'),
    permissionKey('manage', 'Users'),
    permissionKey('create', 'Child Office Accounts'),
  ]),
  [
    body('FirstName').notEmpty().withMessage('First name is required'),
    body('FatherName').notEmpty().withMessage('Father name is required'),
    body('GrandFatherName').notEmpty().withMessage('Grand father name is required'),
    body('Email').isEmail().withMessage('Please enter a valid email'),
    body('UserName').notEmpty().withMessage('Username is required'),
    body('Phone').notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  registerUser
);

router.post(
  '/login',
  [body('UserName').notEmpty().withMessage('Username or email is required'), body('password').notEmpty().withMessage('Password is required')],
  loginUser
);

router.get('/me', protect, getCurrentUser);

// Logout route to clear cookie
router.post('/logout', protect, logoutUser);

export default router;
