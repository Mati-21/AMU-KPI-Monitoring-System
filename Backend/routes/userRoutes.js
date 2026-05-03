const express = require('express');
const { getUsers, getUserById, updateUser, deleteUser, resetUserPassword } = require('../controllers/userController');
const { protect, requirePermission, permissionKey } = require('../middleware/authMiddleware');

const router = express.Router();

const viewUserPermissions = [
  permissionKey('view', 'User Management'),
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('delete', 'User Management'),
  permissionKey('manage', 'Users'),
  permissionKey('create', 'Child Office Accounts'),
];

router.route('/').get(protect, requirePermission(viewUserPermissions), getUsers);
router
  .route('/:id')
  .get(protect, requirePermission(viewUserPermissions), getUserById)
  .put(protect, updateUser)
  .delete(
    protect,
    requirePermission([permissionKey('delete', 'User Management'), permissionKey('edit', 'User Management'), permissionKey('manage', 'Users')]),
    deleteUser
  );
router
  .route('/:id/reset-password')
  .put(protect, requirePermission([permissionKey('edit', 'User Management'), permissionKey('manage', 'Users')]), resetUserPassword);

module.exports = router;
