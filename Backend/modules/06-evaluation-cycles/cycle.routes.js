import { Router } from 'express';
import * as cycleController from './cycle.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evaluation Cycles & Reports
 *   description: Evaluation Windows & Official Office Submission Dossiers (Module 06 - Cadence)
 */

/**
 * @swagger
 * /api/cycles:
 *   get:
 *     summary: List All Evaluation Cycles (Q1, Q2, Mid-Year, Annual)
 *     tags: [Evaluation Cycles & Reports]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: fiscalYearId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of evaluation cycles
 *   post:
 *     summary: Schedule a New Evaluation Period with Reporting Deadline
 *     tags: [Evaluation Cycles & Reports]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fiscalYearId
 *               - name
 *               - periodStart
 *               - periodEnd
 *             properties:
 *               fiscalYearId:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: Q1 2026/2027 Evaluation
 *               periodStart:
 *                 type: string
 *                 format: date
 *                 example: 2026-09-01
 *               periodEnd:
 *                 type: string
 *                 format: date
 *                 example: 2026-11-30
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-12-07
 *     responses:
 *       201:
 *         description: Cycle scheduled
 */
router.get('/', protect, cycleController.getCycles);
router.post('/', protect, admin, cycleController.createCycle);

/**
 * @swagger
 * /api/cycles/{id}/status:
 *   patch:
 *     summary: Transition Cycle Status (planned, open, in_review, closed)
 *     tags: [Evaluation Cycles & Reports]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [planned, open, in_review, closed]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', protect, admin, cycleController.updateCycleStatus);

/**
 * @swagger
 * /api/cycles/reports/initiate:
 *   post:
 *     summary: Initialize or Fetch Draft Submission Dossier for an Office in an Active Cycle
 *     tags: [Evaluation Cycles & Reports]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - evalCycleId
 *               - officeId
 *             properties:
 *               evalCycleId:
 *                 type: string
 *               officeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dossier record
 */
router.post('/reports/initiate', protect, cycleController.getOrInitiateReport);

/**
 * @swagger
 * /api/cycles/reports/{id}/submit:
 *   post:
 *     summary: Formally Submit Office Report Dossier for Evaluator Review
 *     tags: [Evaluation Cycles & Reports]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dossier submitted
 */
router.post('/reports/:id/submit', protect, cycleController.submitReport);

/**
 * @swagger
 * /api/cycles/reports/{id}/review:
 *   post:
 *     summary: Review Office Report Dossier (approved, rejected, reopened) with Feedback Notes
 *     tags: [Evaluation Cycles & Reports]
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
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [approved, rejected, reopened]
 *               reviewNote:
 *                 type: string
 *                 example: Verified research publications and patents.
 *     responses:
 *       200:
 *         description: Review result recorded
 */
router.post('/reports/:id/review', protect, cycleController.reviewReport);

export default router;
