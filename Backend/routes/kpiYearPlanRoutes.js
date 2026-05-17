const express = require('express');
const router = express.Router();
const kpiYearPlanController = require('../controllers/kpiYearPlanController');
const { protect } = require('../middleware/authMiddleware');

const rootRoleOnly = (req, res, next) => {
  if (req.user && req.user.currentRole && !req.user.currentRole.ParentRoleId) {
    next();
  } else {
    res.status(403).json({ message: 'Only root roles can perform this action' });
  }
};

router.use(protect);

router.get('/', kpiYearPlanController.getYearPlans);
router.get('/cycle-readiness', rootRoleOnly, kpiYearPlanController.getCycleReadiness);
router.post('/close-year', rootRoleOnly, kpiYearPlanController.closeCycleYear);
router.post('/:id/refresh', rootRoleOnly, kpiYearPlanController.refreshPlanPerformance);

module.exports = router;
