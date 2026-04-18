const express = require('express');
const { protect, requireModulePermission } = require('../middleware/authMiddleware');
const { createKPI, getKPIs, getKPIById, updateKPI, deleteKPI } = require('../controllers/kpiController');

const router = express.Router();

router
  .route('/')
  .post(protect, requireModulePermission('KPI Management', 'create'), createKPI)
  .get(protect, requireModulePermission('KPI Management', 'view'), getKPIs);

router
  .route('/:id')
  .get(protect, requireModulePermission('KPI Management', 'view'), getKPIById)
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateKPI)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteKPI);

module.exports = router;
