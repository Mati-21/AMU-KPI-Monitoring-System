import { Router } from 'express';
import * as kpiController from './kpi.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: KPI Catalog
 *   description: Module 04 — Fiscal years, strategic themes and the master KPI catalog
 */

/**
 * @swagger
 * /api/v1/fiscal-years:
 *   get:
 *     summary: List fiscal years with status (planned, active, closed)
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Fiscal years }
 *   post:
 *     summary: Create a planning fiscal year
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, startDate, endDate]
 *             properties:
 *               label: { type: string, example: "2018 E.C." }
 *               startDate: { type: string, format: date, example: "2025-07-08" }
 *               endDate: { type: string, format: date, example: "2026-07-07" }
 *     responses:
 *       201: { description: Created }
 */
router.get('/fiscal-years', protect, kpiController.listFiscalYears);
router.post('/fiscal-years', protect, requirePermission(PERMISSIONS.KPI_MANAGE), kpiController.createFiscalYear);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}/activate:
 *   patch:
 *     summary: Activate a fiscal year and deactivate the others
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Activated }
 */
router.patch('/fiscal-years/:id/activate', protect, requirePermission(PERMISSIONS.KPI_MANAGE), kpiController.activateFiscalYear);

/**
 * @swagger
 * /api/v1/kpi-themes:
 *   get:
 *     summary: Strategic theme hierarchy with nested sub-themes and KPI counts
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Theme tree }
 *   post:
 *     summary: Create a strategic theme or sub-theme
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Academic Excellence }
 *               code: { type: string, example: AE }
 *               parentThemeId: { type: string, format: uuid }
 *               sortOrder: { type: integer, default: 0 }
 *     responses:
 *       201: { description: Created }
 */
router.get('/kpi-themes', protect, kpiController.getThemeTree);
router.post('/kpi-themes', protect, requirePermission(PERMISSIONS.KPI_MANAGE), kpiController.createTheme);

/**
 * @swagger
 * /api/v1/kpis:
 *   get:
 *     summary: List master KPIs
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: kpiThemeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: direction, schema: { type: string, enum: [higher_is_better, lower_is_better] } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       200: { description: KPIs }
 *   post:
 *     summary: Register a master KPI
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kpiThemeId, code, name, unitOfMeasure]
 *             properties:
 *               kpiThemeId: { type: string, format: uuid }
 *               code: { type: string, example: KPI-AE-001 }
 *               name: { type: string, example: Graduation rate }
 *               unitOfMeasure: { type: string, example: percent }
 *               direction: { type: string, enum: [higher_is_better, lower_is_better], default: higher_is_better }
 *               cascadeMode: { type: string, enum: [split, replicate, aggregate], default: split }
 *               maxOverAllocationPercent: { type: number, example: 10 }
 *               sortOrder: { type: integer, default: 0 }
 *     responses:
 *       201: { description: Created }
 */
router.get('/kpis', protect, kpiController.listKpis);
router.post('/kpis', protect, requirePermission(PERMISSIONS.KPI_CREATE), kpiController.createKpi);

/**
 * @swagger
 * /api/v1/kpis/{id}:
 *   get:
 *     summary: KPI details
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: KPI }
 *   put:
 *     summary: Update KPI parameters (set isActive=false to retire)
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               unitOfMeasure: { type: string }
 *               direction: { type: string }
 *               cascadeMode: { type: string }
 *               maxOverAllocationPercent: { type: number }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.get('/kpis/:id', protect, kpiController.getKpiById);
router.put('/kpis/:id', protect, requirePermission(PERMISSIONS.KPI_UPDATE), kpiController.updateKpi);

export default router;
