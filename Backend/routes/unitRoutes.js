const express = require('express');
const { protect, requireModulePermission } = require('../middleware/authMiddleware');
const { createUnit, getUnits, getUnitById, updateUnit, deleteUnit } = require('../controllers/unitController');

const router = express.Router();

router
  .route('/')
  .post(protect, requireModulePermission('KPI Management', 'create'), createUnit)
  .get(protect, requireModulePermission('KPI Management', 'view'), getUnits);

router
  .route('/:id')
  .get(protect, requireModulePermission('KPI Management', 'view'), getUnitById)
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateUnit)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteUnit);

module.exports = router;
