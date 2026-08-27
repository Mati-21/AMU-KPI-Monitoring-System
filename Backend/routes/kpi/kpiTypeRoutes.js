import express from 'express';
import { protect, requireModulePermission, requirePermission, permissionKey  } from '../../middleware/authMiddleware.js';
import { createKPIType, getKPITypes, getKPITypeById, updateKPIType, deleteKPIType  } from '../../controllers/kpi/kpiTypeController.js';

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

export default router;
