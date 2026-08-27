import express from 'express';
import { createRole, getRoles, getRoleById, updateRole, deleteRole  } from '../../controllers/user/roleController.js';
import { protect, admin, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';

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

export default router;
