import { Router } from 'express';
import * as dashboardController from './dashboard.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canRead = requirePermission(PERMISSIONS.DASHBOARD_READ);

/**
 * Module 11 — Dashboards. Read-only: they show results saved by Module 07 and calculate no new contract scores.
 *
 * @swagger
 * tags:
 *   name: Dashboards
 *   description: Module 11 — University, parent office and own office performance views
 * /api/v1/dashboards/university:
 *   get:
 *     summary: The whole university for a year. Needs dashboard:read over the top office
 *     description: |
 *       Only approved reports count as official. Each KPI's outcome is EXCEEDING, MEETING, BELOW, IN_PROGRESS (a running
 *       total before year end), NOT_REPORTED, PENDING, RETURNED, REJECTED or NOT_CALCULABLE. Office scores are never averaged.
 *     tags: [Dashboards]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid }, description: Defaults to the active year }
 *       - { in: query, name: reportingPeriodId, schema: { type: string, format: uuid }, description: Just this period }
 *     responses:
 *       200: { description: "{ fiscalYear, office, score, summary, kpis, trend, history, byStrategicObjective, byOfficeType }" }
 *       403: { description: Not over the top office }
 *       404: { description: "No such year or period, or no active year" }
 * /api/v1/dashboards/offices/{officeId}:
 *   get:
 *     summary: One office's own dashboard
 *     tags: [Dashboards]
 *     parameters:
 *       - { in: path, name: officeId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid }, description: Defaults to the active year }
 *       - { in: query, name: reportingPeriodId, schema: { type: string, format: uuid }, description: Just this period }
 *     responses:
 *       200: { description: "{ fiscalYear, office, score, summary, kpis, trend, deadlines, evidence, feedback, history }" }
 *       403: { description: Office not in your scope }
 * /api/v1/dashboards/offices/{officeId}/subordinates:
 *   get:
 *     summary: A parent office's dashboard, comparing its direct subordinate offices
 *     tags: [Dashboards]
 *     parameters:
 *       - { in: path, name: officeId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid }, description: Defaults to the active year }
 *       - { in: query, name: reportingPeriodId, schema: { type: string, format: uuid }, description: Just this period }
 *     responses:
 *       200: { description: "{ fiscalYear, office, score, summary, kpis, responsibilities, subordinates, reports: { awaitingReview, pending } }" }
 *       403: { description: Office not in your scope }
 */
router.get('/dashboards/university', protect, canRead, dashboardController.getUniversityDashboard);
router.get('/dashboards/offices/:officeId', protect, canRead, dashboardController.getOfficeDashboard);
router.get('/dashboards/offices/:officeId/subordinates', protect, canRead, dashboardController.getParentOfficeDashboard);

export default router;
