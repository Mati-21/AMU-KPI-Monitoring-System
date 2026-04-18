const express = require('express');
const { createRole, getRoles, getRoleById, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, admin, requireModulePermission } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/').post(protect, admin, createRole).get(protect, requireModulePermission('KPI Management', 'view'), getRoles);

router
  .route('/:id')
  .get(protect, requireModulePermission('KPI Management', 'view'), getRoleById)
  .put(protect, admin, updateRole)
  .delete(protect, admin, deleteRole);

module.exports = router;
