const express = require('express');
const { createRole, getRoles, getRoleById, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, admin, requirePermission, permissionKey } = require('../middleware/authMiddleware');

const router = express.Router();

const viewRolePermissions = [
  permissionKey('view', 'Sub Unit'),
  permissionKey('view', 'KPI Allocation'),
  permissionKey('create', 'KPI Allocation'),
  permissionKey('view', 'Role Management'),
  permissionKey('create', 'Role Management'),
  permissionKey('manage', 'Users'),
  permissionKey('create', 'Child Office Accounts'),
];

router
  .route('/')
  .post(protect, requirePermission([permissionKey('create', 'Role Management'), permissionKey('manage', 'Roles')]), createRole)
  .get(protect, requirePermission(viewRolePermissions), getRoles);

router
  .route('/:id')
  .get(protect, requirePermission(viewRolePermissions), getRoleById)
  .put(
    protect,
    requirePermission([
      permissionKey('edit', 'Role Management'),
      permissionKey('create', 'Role Management'),
      permissionKey('manage', 'Roles'),
      permissionKey('manage', 'Permissions'),
    ]),
    updateRole
  )
  .delete(protect, admin, deleteRole);

module.exports = router;
