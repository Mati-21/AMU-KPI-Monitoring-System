import { Router } from 'express';
import * as periodController from './period.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canManage = requirePermission(PERMISSIONS.PERIOD_MANAGE);

/**
 * @swagger
 * tags:
 *   name: Reporting Periods
 *   description: Module 06 — When offices report, per fiscal year and frequency
 */

/**
 * @swagger
 * /api/v1/reporting-periods:
 *   get:
 *     summary: List periods, earliest first, each with its current phase
 *     description: "phase is UPCOMING, IN_PROGRESS, SUBMISSION_OPEN, OVERDUE or CLOSED, calculated from today's date."
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: string, format: uuid } }
 *       - { in: query, name: frequencyId, schema: { type: string, format: uuid } }
 *       - { in: query, name: isClosed, schema: { type: boolean } }
 *     responses:
 *       200: { description: Reporting periods }
 *   post:
 *     summary: Create one period by hand, for custom frequencies or irregular dates
 *     tags: [Reporting Periods]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fiscalYearId, frequencyId, name, startDate, endDate]
 *             properties:
 *               fiscalYearId: { type: string, format: uuid }
 *               frequencyId: { type: string, format: uuid }
 *               name: { type: string, example: Accreditation window }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               submissionDeadline: { type: string, format: date, description: Defaults to the end date plus reporting.submission_window_days }
 *               isYearEnd: { type: boolean, default: false, description: Takes the year's final report; must end on the year's last day }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Overlaps a period of the same frequency, or the year is closed }
 */
router.get('/reporting-periods', protect, periodController.listPeriods);
router.post('/reporting-periods', protect, canManage, periodController.createPeriod);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}/reporting-periods/generate:
 *   post:
 *     summary: Create all periods of a frequency for a fiscal year, such as Q1 to Q4
 *     description: Annual generates the year-end period, whose report is the year's final report.
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [frequencyId]
 *             properties:
 *               frequencyId: { type: string, format: uuid }
 *     responses:
 *       201: { description: The generated periods }
 *       400: { description: Custom frequencies have no fixed interval }
 *       409: { description: Periods of this frequency already exist, or the year is closed }
 */
router.post('/fiscal-years/:id/reporting-periods/generate', protect, canManage, periodController.generatePeriods);

/**
 * @swagger
 * /api/v1/reporting-periods/{id}:
 *   get:
 *     summary: One reporting period
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Reporting period }
 *   put:
 *     summary: Change a period. Once reports or results depend on it, only the deadline can change
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *               submissionDeadline: { type: string, format: date, nullable: true }
 *               isYearEnd: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Closed, or in use }
 *   delete:
 *     summary: Delete a period that nothing depends on
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: Reports or results depend on it }
 */
router.get('/reporting-periods/:id', protect, periodController.getPeriodById);
router.put('/reporting-periods/:id', protect, canManage, periodController.updatePeriod);
router.delete('/reporting-periods/:id', protect, canManage, periodController.deletePeriod);

/**
 * @swagger
 * /api/v1/reporting-periods/{id}/close:
 *   patch:
 *     summary: Close a period so it stops taking submissions
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { reason: { type: string } } }
 *     responses:
 *       200: { description: Closed }
 * /api/v1/reporting-periods/{id}/reopen:
 *   patch:
 *     summary: Reopen a closed period, with a reason
 *     tags: [Reporting Periods]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [reason], properties: { reason: { type: string } } }
 *     responses:
 *       200: { description: Reopened }
 */
router.patch('/reporting-periods/:id/close', protect, canManage, periodController.closePeriod);
router.patch('/reporting-periods/:id/reopen', protect, canManage, periodController.reopenPeriod);

export default router;
