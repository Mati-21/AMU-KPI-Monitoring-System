const express = require('express');
const { protect, requireModulePermission, requirePermission, permissionKey } = require('../middleware/authMiddleware');
const { createKPI, getKPIs, getKPIById, updateKPI, deleteKPI } = require('../controllers/kpiController');

const router = express.Router();

router
  .route('/')
  .post(protect, requireModulePermission('KPI Management', 'create'), createKPI)
  .get(
    protect,
    requirePermission([
      permissionKey('view', 'KPI Management'),
      permissionKey('view', 'Assigned KPI'),
      permissionKey('view', 'KPI Allocation'),
      permissionKey('create', 'KPI Allocation'),
      permissionKey('create', 'KPI Allocation'),
    ]),
    getKPIs
  );

router
  .route('/:id')
  .get(
    protect,
    requirePermission([
      permissionKey('view', 'KPI Management'),
      permissionKey('view', 'Assigned KPI'),
      permissionKey('view', 'KPI Allocation'),
      permissionKey('create', 'KPI Allocation'),
      permissionKey('create', 'KPI Allocation'),
    ]),
    getKPIById
  )
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateKPI)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteKPI);

module.exports = router;
