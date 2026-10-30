import { Router } from 'express';
import * as reportController from './report.controller.js';
import { protect, requirePermission } from '../../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../../config/permissions.js';

const router = Router();
const canRead = requirePermission(PERMISSIONS.REPORT_READ);
const canCreate = requirePermission(PERMISSIONS.REPORT_CREATE);
const canReview = requirePermission(PERMISSIONS.REPORT_REVIEW);

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: Reports you may see. Offices above see a report only once it is submitted
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: contractId, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: reportingPeriodId, schema: { type: string, format: uuid } }
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [NOT_STARTED, DRAFT, SUBMITTED, UNDER_REVIEW, REVISION_REQUIRED, APPROVED, REJECTED, OVERDUE] } }
 *     responses:
 *       200: { description: Reports, each with isOverdue }
 *   post:
 *     summary: Start an office's report for a period. The contract must be approved
 *     tags: [Performance Scoring]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, reportingPeriodId]
 *             properties:
 *               contractId: { type: string, format: uuid }
 *               reportingPeriodId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Started }
 *       409: { description: "Already exists, contract not approved, or period closed" }
 * /api/v1/reports/{id}:
 *   get:
 *     summary: A report with every KPI line, its figures and its achievement
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Report with lines: baseline, target, direct, aggregated, total, achievement" }
 * /api/v1/reports/{id}/values:
 *   put:
 *     summary: Enter the office's own results. Fields follow each KPI's measurement type
 *     description: |
 *       NUMBER and MONEY use value (MONEY may give another currencyId, converted with the latest rate); PERCENTAGE and
 *       RATIO use numerator and denominator; STAGE and CATEGORY use scaleLevelId. reportingStatus NOT_REPORTED states a
 *       result is missing; it is never treated as zero.
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [values]
 *             properties:
 *               values:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [assignmentId]
 *                   properties:
 *                     assignmentId: { type: string, format: uuid }
 *                     reportingStatus: { type: string, enum: [REPORTED, NOT_REPORTED], default: REPORTED }
 *                     value: { type: number, example: 65 }
 *                     numerator: { type: number }
 *                     denominator: { type: number }
 *                     scaleLevelId: { type: string, format: uuid }
 *                     currencyId: { type: string, format: uuid }
 *                     note: { type: string }
 *     responses:
 *       200: { description: Saved }
 *       409: { description: Report or period no longer open }
 * /api/v1/reports/{id}/submit:
 *   patch:
 *     summary: Submit for review. Deadlines, grace period and required evidence follow the university's settings
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Submitted; isLate says if it was late" }
 *       409: { description: "Past the deadline, or evidence is missing" }
 * /api/v1/reports/{id}/start-review:
 *   patch:
 *     summary: The office above marks a report as under review
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Under review }
 * /api/v1/reports/{id}/review:
 *   patch:
 *     summary: Approve, reject or ask for revision. Approval makes results official and refreshes the office above
 *     tags: [Performance Scoring]
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
 *               decision: { type: string, enum: [APPROVED, REJECTED, REVISION_REQUIRED] }
 *               comment: { type: string, description: Required unless approving }
 *     responses:
 *       200: { description: Reviewed }
 *       409: { description: Evidence is not all verified }
 */
router.get('/reports', protect, canRead, reportController.listReports);
router.post('/reports', protect, canCreate, reportController.createReport);
router.get('/reports/:id', protect, canRead, reportController.getReportById);
router.put('/reports/:id/values', protect, canCreate, reportController.saveValues);
router.patch('/reports/:id/submit', protect, requirePermission(PERMISSIONS.REPORT_SUBMIT), reportController.submitReport);
router.patch('/reports/:id/start-review', protect, canReview, reportController.startReview);
router.patch('/reports/:id/review', protect, canReview, reportController.reviewReport);

export default router;
