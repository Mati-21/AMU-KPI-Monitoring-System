import express from 'express';
const router = express.Router();
import * as kpiYearPlanController from '../../controllers/kpi/kpiYearPlanController.js';
import { protect  } from '../../middleware/authMiddleware.js';

const rootRoleOnly = (req, res, next) => {
  if (req.user && req.user.currentRole && !req.user.currentRole.ParentRoleId) {
    next();
  } else {
    res.status(403).json({ message: 'Only root roles can perform this action' });
  }
};

router.use(protect);

router.get('/', kpiYearPlanController.getYearPlans);
router.get('/cycle-years', kpiYearPlanController.getCycleYears);
router.get('/cycle-readiness', rootRoleOnly, kpiYearPlanController.getCycleReadiness);
router.post('/close-year', rootRoleOnly, kpiYearPlanController.closeCycleYear);
router.post('/:id/refresh', rootRoleOnly, kpiYearPlanController.refreshPlanPerformance);

export default router;
