import { Router } from 'express';
import * as evaluationController from './evaluation.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Performance Scoring
 *   description: Module 07 — Achievement entries, verification, scoring and scorecards
 */

/**
 * @swagger
 * /api/v1/kpi-evaluations:
 *   get:
 *     summary: List evaluations with filters
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: evalCycleId, schema: { type: string, format: uuid } }
 *       - { in: query, name: kpiTargetId, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, submitted, verified, rejected] } }
 *     responses:
 *       200: { description: Evaluations }
 *   post:
 *     summary: Enter or update the reported value for a target in an open cycle
 *     tags: [Performance Scoring]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kpiTargetId, evalCycleId, reportedValue]
 *             properties:
 *               kpiTargetId: { type: string, format: uuid }
 *               evalCycleId: { type: string, format: uuid }
 *               reportedValue: { type: number, example: 72.5 }
 *               comment: { type: string }
 *     responses:
 *       200: { description: Saved }
 */
router.get('/kpi-evaluations', protect, requirePermission(PERMISSIONS.EVALUATION_READ), evaluationController.listEvaluations);
router.post('/kpi-evaluations', protect, requirePermission(PERMISSIONS.EVALUATION_WRITE), evaluationController.recordEvaluation);

/**
 * @swagger
 * /api/v1/kpi-evaluations/bulk-update:
 *   post:
 *     summary: Save reported values for many targets of an office scorecard
 *     tags: [Performance Scoring]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [evalCycleId, items]
 *             properties:
 *               evalCycleId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [kpiTargetId, reportedValue]
 *                   properties:
 *                     kpiTargetId: { type: string, format: uuid }
 *                     reportedValue: { type: number }
 *                     comment: { type: string }
 *     responses:
 *       200: { description: Saved }
 */
router.post('/kpi-evaluations/bulk-update', protect, requirePermission(PERMISSIONS.EVALUATION_WRITE), evaluationController.bulkRecordEvaluations);

/**
 * @swagger
 * /api/v1/kpi-evaluations/{id}/verify:
 *   patch:
 *     summary: Confirm the actual value and finalize the score
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [actualValue]
 *             properties:
 *               actualValue: { type: number, example: 70 }
 *               comment: { type: string }
 *     responses:
 *       200: { description: Verified }
 */
router.patch('/kpi-evaluations/:id/verify', protect, requirePermission(PERMISSIONS.EVALUATION_VERIFY), evaluationController.verifyEvaluation);

/**
 * @swagger
 * /api/v1/performance/scorecard/office/{officeId}:
 *   get:
 *     summary: Weighted scorecard, theme scores and overall grade for an office
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: officeId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: evalCycleId, schema: { type: string, format: uuid } }
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *     responses:
 *       200: { description: Scorecard }
 */
router.get('/performance/scorecard/office/:officeId', protect, requirePermission(PERMISSIONS.SCORECARD_READ), evaluationController.getOfficeScorecard);

/**
 * @swagger
 * /api/v1/performance/institution-dashboard:
 *   get:
 *     summary: University-wide achievement vs targets for executives
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *       - { in: query, name: evalCycleId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Dashboard aggregates }
 */
router.get('/performance/institution-dashboard', protect, requirePermission(PERMISSIONS.DASHBOARD_READ), evaluationController.getInstitutionDashboard);

export default router;
