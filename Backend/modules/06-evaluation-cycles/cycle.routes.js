import { Router } from 'express';
import * as cycleController from './cycle.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evaluation Cycles
 *   description: Module 06 — Reporting periods and office report dossiers
 */

/**
 * @swagger
 * /api/v1/eval-cycles:
 *   get:
 *     summary: List evaluation cycles with status and submission progress
 *     tags: [Evaluation Cycles]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string, enum: [planned, open, in_review, closed] } }
 *     responses:
 *       200: { description: Cycles }
 *   post:
 *     summary: Schedule an evaluation period
 *     tags: [Evaluation Cycles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fiscalYearId, name, periodStart, periodEnd]
 *             properties:
 *               fiscalYearId: { type: integer, example: 1 }
 *               name: { type: string, example: Q1 }
 *               periodStart: { type: string, format: date }
 *               periodEnd: { type: string, format: date }
 *               dueDate: { type: string, format: date }
 *     responses:
 *       201: { description: Created }
 */
router.get('/eval-cycles', protect, cycleController.listCycles);
router.post('/eval-cycles', protect, requirePermission(PERMISSIONS.CYCLE_MANAGE), cycleController.createCycle);

/**
 * @swagger
 * /api/v1/eval-cycles/{id}/status:
 *   patch:
 *     summary: Transition cycle status
 *     tags: [Evaluation Cycles]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [planned, open, in_review, closed] }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/eval-cycles/:id/status', protect, requirePermission(PERMISSIONS.CYCLE_MANAGE), cycleController.updateCycleStatus);

/**
 * @swagger
 * /api/v1/cycle-reports/initiate:
 *   post:
 *     summary: Create (or return) the draft report dossier for an office in an open cycle
 *     tags: [Evaluation Cycles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [evalCycleId, officeId]
 *             properties:
 *               evalCycleId: { type: string, format: uuid }
 *               officeId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Draft report }
 */
router.post('/cycle-reports/initiate', protect, requirePermission(PERMISSIONS.REPORT_CREATE), cycleController.initiateReport);

/**
 * @swagger
 * /api/v1/cycle-reports/{id}:
 *   get:
 *     summary: Full report dossier with evaluations and review history
 *     tags: [Evaluation Cycles]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Report }
 */
router.get('/cycle-reports/:id', protect, requirePermission(PERMISSIONS.REPORT_READ), cycleController.getReportById);

/**
 * @swagger
 * /api/v1/cycle-reports/{id}/submit:
 *   post:
 *     summary: Lock draft evaluations and submit the dossier for review
 *     tags: [Evaluation Cycles]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Submitted }
 */
router.post('/cycle-reports/:id/submit', protect, requirePermission(PERMISSIONS.REPORT_SUBMIT), cycleController.submitReport);

/**
 * @swagger
 * /api/v1/cycle-reports/{id}/review:
 *   post:
 *     summary: Approve, reject or request changes on a submitted report
 *     tags: [Evaluation Cycles]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approved, rejected, changes_requested] }
 *               reviewNote: { type: string }
 *     responses:
 *       200: { description: Reviewed }
 */
router.post('/cycle-reports/:id/review', protect, requirePermission(PERMISSIONS.REPORT_REVIEW), cycleController.reviewReport);

export default router;
