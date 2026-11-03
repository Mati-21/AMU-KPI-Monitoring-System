import { Router } from 'express';
import * as sheetController from './sheet.controller.js';
import { protect, withAccess } from '../../../middleware/authMiddleware.js';

const router = Router();
// Someone with a staff contract opens its sheet without report permissions; the service checks what each person may see

/**
 * @swagger
 * /api/v1/performance/offices:
 *   get:
 *     summary: Offices with a signed contract in the year whose performance you may open, your own first
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: fiscalYearId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Offices { id, name, code, isOwn }" }
 * /api/v1/performance/sheet:
 *   get:
 *     summary: An office's performance for the year, for entering it. A section per reporting frequency, a column per period
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: fiscalYearId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ contract, sections: [{ frequency, openPeriodId, periods, rows }] }" }
 * /api/v1/performance/year-report:
 *   get:
 *     summary: An office's approved results added up for the year, a column per office below plus its own work
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: query, name: fiscalYearId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: officeId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ contract, columns, showTotal, rows }" }
 */
router.get('/performance/offices', protect, withAccess, sheetController.listPerformanceOffices);
router.get('/performance/sheet', protect, withAccess, sheetController.getPerformanceSheet);
router.get('/performance/year-report', protect, withAccess, sheetController.getYearReport);

export default router;
