const express = require('express');
const { protect, requireModulePermission } = require('../middleware/authMiddleware');
const { createKPIType, getKPITypes, getKPITypeById, updateKPIType, deleteKPIType } = require('../controllers/kpiTypeController');

const router = express.Router();

router
  .route('/')
  .post(protect, requireModulePermission('KPI Management', 'create'), createKPIType)
  .get(protect, requireModulePermission('KPI Management', 'view'), getKPITypes);

router
  .route('/:id')
  .get(protect, requireModulePermission('KPI Management', 'view'), getKPITypeById)
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateKPIType)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteKPIType);

module.exports = router;
