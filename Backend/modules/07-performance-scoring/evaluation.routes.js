import { Router } from 'express';
import * as evaluationController from './evaluation.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Performance Scoring
 *   description: KPI Achievement Progress, Score Formulas & Institutional Scorecards (Module 07 - Scoring)
 */

/**
 * @swagger
 * /api/evaluations:
 *   get:
 *     summary: List KPI Evaluations Filtered by Cycle, Target, and Status
 *     tags: [Performance Scoring]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: evalCycleId
 *         schema:
 *           type: string
 *       - in: query
 *         name: kpiTargetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, submitted, evaluated, verified]
 *     responses:
 *       200:
 *         description: List of evaluations
 *   post:
 *     summary: Record Self-Reported Achievement for a KPI Target in an Active Cycle
 *     tags: [Performance Scoring]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kpiTargetId
 *               - evalCycleId
 *               - reportedValue
 *             properties:
 *               kpiTargetId:
 *                 type: string
 *               evalCycleId:
 *                 type: string
 *               cycleReportId:
 *                 type: string
 *               reportedValue:
 *                 type: number
 *                 example: 15.0
 *               comment:
 *                 type: string
 *                 example: Completed 15 peer-reviewed publications.
 *     responses:
 *       201:
 *         description: Achievement scored and saved
 */
router.get('/', protect, evaluationController.getEvaluations);
router.post('/', protect, evaluationController.recordProgress);

/**
 * @swagger
 * /api/evaluations/{id}/verify:
 *   patch:
 *     summary: Evaluator Audits Evidence, Confirms Actual Value, and Finalizes Score
 *     tags: [Performance Scoring]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualValue
 *             properties:
 *               actualValue:
 *                 type: number
 *                 example: 14.0
 *               comment:
 *                 type: string
 *                 example: Verified 14 publications in Scopus/WoS database.
 *     responses:
 *       200:
 *         description: Verified score recorded
 */
router.patch('/:id/verify', protect, evaluationController.verifyEvaluation);

/**
 * @swagger
 * /api/evaluations/scorecard/office/{officeId}:
 *   get:
 *     summary: Compute Weighted Scorecard Breakdown & Overall Performance Grade for an Office
 *     tags: [Performance Scoring]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: officeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: evalCycleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Office weighted scorecard
 */
router.get('/scorecard/office/:officeId', protect, evaluationController.getOfficeScorecard);

export default router;
