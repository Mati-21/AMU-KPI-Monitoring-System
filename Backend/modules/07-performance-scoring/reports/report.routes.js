import { Router } from 'express';
import * as reportController from './report.controller.js';
import { protect, withAccess, requirePermission, requireSuperAdmin } from '../../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../../config/permissions.js';

const router = Router();
// Reading, starting, filling in and submitting a report need only a signed-in person: someone with a staff contract
// reports on it without report permissions, and the service checks who may act on which report
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
 *       200: { description: "Report with lines (baseline, target, direct, aggregated, total, achievement, evidence) and can: what you may do now" }
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
router.get('/reports', protect, withAccess, reportController.listReports);
router.post('/reports', protect, withAccess, reportController.createReport);
router.get('/reports/:id', protect, withAccess, reportController.getReportById);
router.put('/reports/:id/values', protect, withAccess, reportController.saveValues);
router.patch('/reports/:id/submit', protect, withAccess, reportController.submitReport);
router.patch('/reports/:id/start-review', protect, canReview, reportController.startReview);
router.patch('/reports/:id/review', protect, canReview, reportController.reviewReport);

/**
 * @swagger
 * /api/v1/reports/{id}/reopen:
 *   patch:
 *     summary: Reopen an approved report to correct a mistake (Super Admin only)
 *     description: The report returns to REVISION_REQUIRED. Its results stop being official and everything that depended on them is recalculated. The reason is audited.
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [reason], properties: { reason: { type: string } } }
 *     responses:
 *       200: { description: Reopened }
 *       403: { description: Not a Super Admin }
 *       409: { description: "Not approved, or the period or year is closed" }
 */
router.patch('/reports/:id/reopen', protect, requireSuperAdmin, reportController.reopenReport);

/**
 * @swagger
 * /api/v1/reports/allow-late:
 *   post:
 *     summary: Let one office submit a period after its deadline and grace period (Super Admin only)
 *     description: The report is started if needed. The submission is marked late; the reason is kept in the system log.
 *     tags: [Performance Scoring]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, reportingPeriodId, reason]
 *             properties:
 *               contractId: { type: string, format: uuid }
 *               reportingPeriodId: { type: string, format: uuid }
 *               days: { type: integer, minimum: 1, maximum: 60, default: 7, description: How many days from today it stays open }
 *               reason: { type: string, example: Penalty agreed by the President's office }
 *     responses:
 *       200: { description: The report, open for a late submission }
 *       403: { description: Not a Super Admin }
 */
router.post('/reports/allow-late', protect, requireSuperAdmin, reportController.allowLateSubmission);

export default router;
