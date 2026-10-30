import { Router } from 'express';
import * as scoringController from './scoring.controller.js';
import { protect, requirePermission } from '../../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../../config/permissions.js';

const router = Router();
const canRead = requirePermission(PERMISSIONS.SCORECARD_READ);

/**
 * @swagger
 * /api/v1/scorecards/offices/{officeId}:
 *   get:
 *     summary: One office's contract scores and KPI achievements for a year
 *     description: Improvement and target achievement are separate, raw and capped. isProvisional marks anything not yet final.
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: officeId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: fiscalYearId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: reportingPeriodId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ contract, scores, achievements }" }
 * /api/v1/assignments/{id}/performance:
 *   get:
 *     summary: One assignment across its periods, with the offices below it
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Assignment with achievements and children }
 * /api/v1/kpis/{id}/history:
 *   get:
 *     summary: A KPI's results year by year for one office. Use the top office for the whole university
 *     description: Follows replacesKpiId, so a replaced KPI keeps its trend.
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ lineage, years }" }
 */
router.get('/scorecards/offices/:officeId', protect, canRead, scoringController.getOfficeScorecard);
router.get('/assignments/:id/performance', protect, canRead, scoringController.getAssignmentPerformance);
router.get('/kpis/:id/history', protect, canRead, scoringController.getKpiHistory);

export default router;
