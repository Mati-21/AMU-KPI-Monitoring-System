const express = require('express');
const { createRoleCategory, getRoleCategories, updateRoleCategory, deleteRoleCategory } = require('../controllers/roleCategoryController');
const { protect, admin, requirePermission, permissionKey } = require('../middleware/authMiddleware');

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

module.exports = router;
