const express = require('express');
const { assignRoleToUser, getUserCurrentRole, getAllUserRoles, endUserRole, deleteUserRole } = require('../controllers/userRoleController');
const { protect, requirePermission, permissionKey } = require('../middleware/authMiddleware');

const router = express.Router();

const assignUserRolePermissions = [
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('manage', 'Users'),
  permissionKey('create', 'Child Office Accounts'),
];

const viewUserRolePermissions = [
  permissionKey('view', 'Sub Unit'),
  permissionKey('view', 'KPI Allocation'),
  permissionKey('create', 'KPI Allocation'),
  permissionKey('view', 'User Management'),
  permissionKey('create', 'User Management'),
  permissionKey('edit', 'User Management'),
  permissionKey('manage', 'Users'),
  permissionKey('create', 'Child Office Accounts'),
];

router
  .route('/')
  .post(protect, requirePermission(assignUserRolePermissions), assignRoleToUser)
  .get(protect, requirePermission(viewUserRolePermissions), getAllUserRoles);

router.route('/user/:userId').get(protect, requirePermission(viewUserRolePermissions), getUserCurrentRole);

router.route('/:id/end').put(protect, requirePermission([permissionKey('edit', 'User Management'), permissionKey('manage', 'Users')]), endUserRole);

router
  .route('/:id')
  .delete(protect, requirePermission([permissionKey('delete', 'User Management'), permissionKey('manage', 'Users')]), deleteUserRole);

module.exports = router;
