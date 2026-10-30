import { Router } from 'express';
import reportRoutes from './reports/report.routes.js';
import scoringRoutes from './scoring/scoring.routes.js';
import thresholdRoutes from './thresholds/threshold.routes.js';

/**
 * Module 07 — Performance reporting and scoring.
 *   rules/       calculations only, with no database access
 *   reports/     entering, submitting and reviewing results
 *   scoring/     achievements, roll-ups, contract scores and scorecards
 *   thresholds/  the university's performance bands
 *
 * @swagger
 * tags:
 *   name: Performance Scoring
 *   description: Module 07 — Reports, achievements, roll-ups, contract scores, scorecards and performance bands
 */
const router = Router();

router.use(reportRoutes);
router.use(scoringRoutes);
router.use(thresholdRoutes);

export default router;
