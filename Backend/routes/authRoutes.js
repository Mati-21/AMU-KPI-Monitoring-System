const express = require('express');
const { body } = require('express-validator');
const { registerUser, loginUser, getCurrentUser } = require('../controllers/authController');
const { protect, requirePermission, permissionKey } = require('../middleware/authMiddleware');

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
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true });
});

module.exports = router;
