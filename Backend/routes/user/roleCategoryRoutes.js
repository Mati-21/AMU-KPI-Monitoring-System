import express from 'express';
import { createRoleCategory, getRoleCategories, updateRoleCategory, deleteRoleCategory  } from '../../controllers/user/roleCategoryController.js';
import { protect, admin, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';

const router = express.Router();

router
  .route('/')
  .post(protect, admin, createRoleCategory)
  .get(
    protect,
    requirePermission([permissionKey('view', 'Role Management'), permissionKey('create', 'Role Management'), permissionKey('manage', 'Roles')]),
    getRoleCategories
  );

router.route('/:id').put(protect, admin, updateRoleCategory).delete(protect, admin, deleteRoleCategory);

export default router;
