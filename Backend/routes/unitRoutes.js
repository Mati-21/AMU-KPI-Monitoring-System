const express = require('express');
const { protect, requirePermission, permissionKey } = require('../middleware/authMiddleware');
const { createUnit, getUnits, getUnitById, updateUnit, deleteUnit } = require('../controllers/unitController');

const router = express.Router();

router
  .route('/')
  .post(protect, requirePermission([permissionKey('create', 'Sub Unit'), permissionKey('create', 'Child Office Accounts')]), createUnit)
  .get(protect, requirePermission([permissionKey('view', 'Sub Unit')]), getUnits);

router
  .route('/:id')
  .get(protect, requirePermission([permissionKey('view', 'Sub Unit')]), getUnitById)
  .put(protect, requirePermission([permissionKey('edit', 'Sub Unit')]), updateUnit)
  .delete(protect, requirePermission([permissionKey('delete', 'Sub Unit')]), deleteUnit);

module.exports = router;
