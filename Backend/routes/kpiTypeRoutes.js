const express = require('express');
const { protect, requireModulePermission, requirePermission, permissionKey } = require('../middleware/authMiddleware');
const { createKPIType, getKPITypes, getKPITypeById, updateKPIType, deleteKPIType } = require('../controllers/kpiTypeController');

const router = express.Router();

router
  .route('/')
  .post(protect, requireModulePermission('KPI Management', 'create'), createKPIType)
  .get(
    protect,
    requirePermission([
      permissionKey('view', 'KPI Management'),
      permissionKey('view', 'Assigned KPI'),
      permissionKey('view', 'KPI Allocation'),
      permissionKey('create', 'KPI Allocation'),
    ]),
    getKPITypes
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
    ]),
    getKPITypeById
  )
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateKPIType)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteKPIType);

module.exports = router;
