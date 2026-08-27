import express from 'express';
import { protect, requireModulePermission, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';
import { createKPI, getKPIs, getKPIById, updateKPI, deleteKPI, deleteAllKPIs, importKPIs  } from '../../controllers/kpi/kpiController.js';

const router = express.Router();

router.post('/import', protect, requireModulePermission('KPI Management', 'create'), importKPIs);
router.delete('/delete-all', protect, requireModulePermission('KPI Management', 'delete'), deleteAllKPIs);

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

export default router;
