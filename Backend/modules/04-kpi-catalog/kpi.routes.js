import { Router } from 'express';
import * as kpiController from './kpi.controller.js';
import { protect, requirePermission, requireSuperAdmin } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canManage = requirePermission(PERMISSIONS.KPI_MANAGE);

/**
 * @swagger
 * tags:
 *   name: KPI Catalog
 *   description: Module 04 — Fiscal years, strategic objectives, themes, units, frequencies, scales, currencies and the master KPI catalog
 */

// ===== Fiscal years =====

/**
 * @swagger
 * /api/v1/fiscal-years:
 *   get:
 *     summary: List fiscal years, newest first, with status (PLANNING, ACTIVE, CLOSED)
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Fiscal years }
 *   post:
 *     summary: Create a fiscal year in PLANNING status
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, startDate, endDate]
 *             properties:
 *               name: { type: string, example: "2019 E.C." }
 *               startDate: { type: string, format: date, example: "2026-07-08" }
 *               endDate: { type: string, format: date, example: "2027-07-07" }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Name already used or dates overlap another year }
 */
router.get('/fiscal-years', protect, kpiController.listFiscalYears);
router.post('/fiscal-years', protect, canManage, kpiController.createFiscalYear);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}:
 *   put:
 *     summary: Change name or dates of a year still in PLANNING
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
 *               startDate: { type: string, format: date }
 *               endDate: { type: string, format: date }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Year is no longer in planning }
 */
router.put('/fiscal-years/:id', protect, canManage, kpiController.updateFiscalYear);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}/activate:
 *   patch:
 *     summary: Activate a planning year (the current active year must be closed first)
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Activated }
 *       409: { description: Another year is active, or this one is not in planning }
 */
router.patch('/fiscal-years/:id/activate', protect, canManage, kpiController.activateFiscalYear);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}/close:
 *   patch:
 *     summary: Close the active year. All its data becomes read-only until a Super Admin reopens it
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: Year-end reports approved }
 *     responses:
 *       200: { description: Closed }
 *       409: { description: Year is not active }
 */
router.patch('/fiscal-years/:id/close', protect, canManage, kpiController.closeFiscalYear);

/**
 * @swagger
 * /api/v1/fiscal-years/{id}/reopen:
 *   patch:
 *     summary: Reopen a closed year (Super Admin only). The active year must be closed first
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: Correction to an approved report }
 *     responses:
 *       200: { description: Reopened }
 *       403: { description: Not a Super Admin }
 *       409: { description: Year is not closed, or another year is active }
 */
router.patch('/fiscal-years/:id/reopen', protect, requireSuperAdmin, kpiController.reopenFiscalYear);

// ===== Strategic objectives =====

/**
 * @swagger
 * /api/v1/strategic-objectives:
 *   get:
 *     summary: List strategic objectives with KPI counts
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       200: { description: Objectives }
 *   post:
 *     summary: Create a strategic objective
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, example: SO-1 }
 *               name: { type: string, example: Strengthen research output }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.get('/strategic-objectives', protect, kpiController.listObjectives);
router.post('/strategic-objectives', protect, canManage, kpiController.createObjective);

/**
 * @swagger
 * /api/v1/strategic-objectives/{id}:
 *   put:
 *     summary: Update a strategic objective
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/strategic-objectives/:id', protect, canManage, kpiController.updateObjective);

// ===== Themes =====

/**
 * @swagger
 * /api/v1/kpi-themes:
 *   get:
 *     summary: Theme hierarchy with nested sub-themes and KPI counts
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Theme tree }
 *   post:
 *     summary: Create a theme or sub-theme
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Research }
 *               code: { type: string, example: RES }
 *               description: { type: string }
 *               parentThemeId: { type: string, format: uuid }
 *               sortOrder: { type: integer, default: 0 }
 *     responses:
 *       201: { description: Created }
 */
router.get('/kpi-themes', protect, kpiController.getThemeTree);
router.post('/kpi-themes', protect, canManage, kpiController.createTheme);

/**
 * @swagger
 * /api/v1/kpi-themes/{id}:
 *   put:
 *     summary: Update, move or deactivate a theme
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
 *               code: { type: string }
 *               description: { type: string }
 *               parentThemeId: { type: string, format: uuid, nullable: true }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Still has active sub-themes or KPIs }
 */
router.put('/kpi-themes/:id', protect, canManage, kpiController.updateTheme);

// ===== Measurement units =====

/**
 * @swagger
 * /api/v1/measurement-units:
 *   get:
 *     summary: List measurement units
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Units }
 *   post:
 *     summary: Create a measurement unit
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Publications }
 *               symbol: { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.get('/measurement-units', protect, kpiController.listUnits);
router.post('/measurement-units', protect, canManage, kpiController.createUnit);

/**
 * @swagger
 * /api/v1/measurement-units/{id}:
 *   put:
 *     summary: Update a unit that no KPI uses yet
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
 *               symbol: { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Unit is used by a KPI }
 */
router.put('/measurement-units/:id', protect, canManage, kpiController.updateUnit);

// ===== Reporting frequencies =====

/**
 * @swagger
 * /api/v1/reporting-frequencies:
 *   get:
 *     summary: List reporting frequencies (monthly, quarterly, semi-annual, annual, custom)
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Frequencies }
 *   post:
 *     summary: Create a reporting frequency
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Every two months }
 *               intervalMonths: { type: integer, minimum: 1, maximum: 12, description: Required unless isCustom }
 *               isCustom: { type: boolean, default: false }
 *     responses:
 *       201: { description: Created }
 */
router.get('/reporting-frequencies', protect, kpiController.listFrequencies);
router.post('/reporting-frequencies', protect, canManage, kpiController.createFrequency);

/**
 * @swagger
 * /api/v1/reporting-frequencies/{id}:
 *   put:
 *     summary: Rename a frequency, or change its interval while nothing uses it
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
 *               intervalMonths: { type: integer }
 *               isCustom: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Frequency is in use }
 */
router.put('/reporting-frequencies/:id', protect, canManage, kpiController.updateFrequency);

// ===== Scales =====

/**
 * @swagger
 * /api/v1/kpi-scales:
 *   get:
 *     summary: List stage and category scales with their levels
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: query, name: scaleType, schema: { type: string, enum: [STAGE, CATEGORY] } }
 *     responses:
 *       200: { description: Scales, each with isLocked }
 *   post:
 *     summary: Create a stage or category scale
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scaleType, levels]
 *             properties:
 *               name: { type: string, example: Digital Maturity }
 *               scaleType: { type: string, enum: [STAGE, CATEGORY] }
 *               isOrdered: { type: boolean, default: true }
 *               isBinary: { type: boolean, default: false }
 *               levels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     name: { type: string, example: Developing }
 *                     description: { type: string }
 *                     sortOrder: { type: integer }
 *                     score: { type: number }
 *                     assessmentCriteria: { type: string, description: Required for stages }
 *     responses:
 *       201: { description: Created }
 */
router.get('/kpi-scales', protect, kpiController.listScales);
router.post('/kpi-scales', protect, canManage, kpiController.createScale);

/**
 * @swagger
 * /api/v1/kpi-scales/{id}:
 *   get:
 *     summary: Scale with its levels
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Scale }
 *   put:
 *     summary: Replace a scale's definition and levels. Refused once a KPI uses it; withdraws scoring approval
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
 *               scaleType: { type: string, enum: [STAGE, CATEGORY] }
 *               isOrdered: { type: boolean }
 *               isBinary: { type: boolean }
 *               levels: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Scale is locked }
 */
router.get('/kpi-scales/:id', protect, kpiController.getScaleById);
router.put('/kpi-scales/:id', protect, canManage, kpiController.updateScale);

/**
 * @swagger
 * /api/v1/kpi-scales/{id}/scoring:
 *   patch:
 *     summary: Approve or withdraw numerical scoring for a scale
 *     description: Needs a score on every level, in steady order. Binary scales cannot be scored. Approval cannot be withdrawn once a KPI uses the scale.
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Scale does not qualify }
 *       409: { description: Scale is locked }
 */
router.patch('/kpi-scales/:id/scoring', protect, canManage, kpiController.setScaleScoring);

// ===== Currencies and exchange rates =====

/**
 * @swagger
 * /api/v1/currencies:
 *   get:
 *     summary: List currencies, reporting currency first
 *     tags: [KPI Catalog]
 *     responses:
 *       200: { description: Currencies }
 *   post:
 *     summary: Create a currency
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, example: USD }
 *               name: { type: string, example: US Dollar }
 *               symbol: { type: string, example: $ }
 *               isReportingCurrency: { type: boolean, default: false }
 *     responses:
 *       201: { description: Created }
 */
router.get('/currencies', protect, kpiController.listCurrencies);
router.post('/currencies', protect, canManage, kpiController.createCurrency);

/**
 * @swagger
 * /api/v1/currencies/{id}:
 *   put:
 *     summary: Update a currency, or make it the reporting currency
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               symbol: { type: string }
 *               isReportingCurrency: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/currencies/:id', protect, canManage, kpiController.updateCurrency);

/**
 * @swagger
 * /api/v1/exchange-rates:
 *   get:
 *     summary: List exchange rates, newest first
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: query, name: fromCurrencyId, schema: { type: string, format: uuid } }
 *       - { in: query, name: toCurrencyId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Rates }
 *   post:
 *     summary: Record an exchange rate for a date. Rates are never edited
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromCurrencyId, toCurrencyId, rate, rateDate]
 *             properties:
 *               fromCurrencyId: { type: string, format: uuid }
 *               toCurrencyId: { type: string, format: uuid }
 *               rate: { type: number, example: 56.5 }
 *               rateDate: { type: string, format: date }
 *               source: { type: string, example: National Bank of Ethiopia }
 *     responses:
 *       201: { description: Created }
 */
router.get('/exchange-rates', protect, kpiController.listExchangeRates);
router.post('/exchange-rates', protect, canManage, kpiController.createExchangeRate);

// ===== KPIs =====

/**
 * @swagger
 * /api/v1/kpis:
 *   get:
 *     summary: List master KPIs
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: Code or name }
 *       - { in: query, name: themeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: strategicObjectiveId, schema: { type: string, format: uuid } }
 *       - { in: query, name: measurementType, schema: { type: string, enum: [NUMBER, PERCENTAGE, RATIO, STAGE, CATEGORY, MONEY] } }
 *       - { in: query, name: direction, schema: { type: string, enum: [HIGHER_IS_BETTER, LOWER_IS_BETTER, MAINTAIN] } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: "{ data: [{ ..., isLocked }], pagination }" }
 *   post:
 *     summary: Register a master KPI, optionally replacing an older one
 *     description: |
 *       Fields needed depend on measurementType. PERCENTAGE and RATIO need numerator and denominator labels, STAGE and
 *       CATEGORY a scale, MONEY a currency, NUMBER a unit. Methods left out get the usual choice for the type;
 *       scoringMethod defaults to the setting kpi.official_basis. replacesKpiId retires the old KPI.
 *     tags: [KPI Catalog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, description, themeId, strategicObjectiveId, measurementType, direction, defaultFrequencyId, dataSource, evidenceRequirement]
 *             properties:
 *               code: { type: string, example: KPI-RES-001 }
 *               name: { type: string, example: Number of research publications }
 *               description: { type: string }
 *               themeId: { type: string, format: uuid }
 *               strategicObjectiveId: { type: string, format: uuid }
 *               measurementType: { type: string, enum: [NUMBER, PERCENTAGE, RATIO, STAGE, CATEGORY, MONEY] }
 *               unitId: { type: string, format: uuid }
 *               scaleId: { type: string, format: uuid }
 *               currencyId: { type: string, format: uuid }
 *               direction: { type: string, enum: [HIGHER_IS_BETTER, LOWER_IS_BETTER, MAINTAIN] }
 *               targetType: { type: string, enum: [MINIMUM, MAXIMUM, EXACT] }
 *               numeratorLabel: { type: string }
 *               denominatorLabel: { type: string }
 *               formula: { type: string }
 *               dataSource: { type: string }
 *               defaultFrequencyId: { type: string, format: uuid }
 *               evidenceRequirement: { type: string }
 *               aggregationMethod: { type: string, enum: [SUM, RATIO_OF_SUMS, WEIGHTED_SCORE, SHARE_MEETING_TARGET, WEAKEST_LINK, STAGE_DISTRIBUTION, DIRECT] }
 *               periodRollupMethod: { type: string, enum: [SUM, RATIO_OF_SUMS, LATEST, AVERAGE] }
 *               scoringMethod: { type: string, enum: [IMPROVEMENT, TARGET] }
 *               zeroTargetRule: { type: string, enum: [NOT_CALCULABLE, FULL_IF_MET] }
 *               isAdditive: { type: boolean }
 *               decimalPlaces: { type: integer, default: 2 }
 *               maintenanceTolerance: { type: number, description: Required for MAINTAIN }
 *               coordinatingOfficeId: { type: string, format: uuid }
 *               replacesKpiId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created }
 *       400: { description: "Invalid definition; details.errors lists every problem" }
 */
router.get('/kpis', protect, kpiController.listKpis);
router.post('/kpis', protect, requirePermission(PERMISSIONS.KPI_CREATE), kpiController.createKpi);

/**
 * @swagger
 * /api/v1/kpis/{id}:
 *   get:
 *     summary: KPI definition with isLocked and the KPIs it replaces or was replaced by
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: KPI }
 *   put:
 *     summary: Update a KPI. Once locked, only isActive, coordinatingOfficeId and defaultFrequencyId can change
 *     tags: [KPI Catalog]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Same fields as registering a KPI, plus isActive
 *     responses:
 *       200: { description: Updated }
 *       409: { description: "KPI is locked; details.locked lists the refused fields" }
 */
router.get('/kpis/:id', protect, kpiController.getKpiById);
router.put('/kpis/:id', protect, requirePermission(PERMISSIONS.KPI_UPDATE), kpiController.updateKpi);

export default router;
