import { Router } from 'express';
import * as kpiController from './kpi.controller.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = Router();

router.get('/', protect, kpiController.getKpis);
router.post('/', protect, kpiController.createKpi);
router.get('/:id', protect, kpiController.getKpiById);
router.put('/:id', protect, kpiController.updateKpi);
router.delete('/:id', protect, kpiController.deleteKpi);

export default router;
