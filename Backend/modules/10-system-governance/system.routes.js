import { Router } from 'express';
import * as systemController from './system.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: System Governance & Audit
 *   description: Dynamic Configurations, Public Parameters & Compliance Logs (Module 10 - Governance)
 */

/**
 * @swagger
 * /api/system/public:
 *   get:
 *     summary: Retrieve Public System Configuration (Branding, App Name)
 *     tags: [System Governance & Audit]
 *     responses:
 *       200:
 *         description: Public key-value parameters
 */
router.get('/public', systemController.getPublicSettings);

/**
 * @swagger
 * /api/system/settings:
 *   get:
 *     summary: Retrieve All System Configuration Settings Grouped by Category
 *     tags: [System Governance & Audit]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Categorized settings dictionary
 *   put:
 *     summary: Create or Update a System Configuration Setting
 *     tags: [System Governance & Audit]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *               - key
 *               - value
 *             properties:
 *               groupName:
 *                 type: string
 *                 example: branding
 *               key:
 *                 type: string
 *                 example: system_title
 *               value:
 *                 type: string
 *                 example: Arba Minch University KPI Portal
 *               valueType:
 *                 type: string
 *                 example: text
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Setting saved
 */
router.get('/settings', protect, admin, systemController.getAllSettings);
router.put('/settings', protect, admin, systemController.upsertSetting);

/**
 * @swagger
 * /api/system/audit-logs:
 *   get:
 *     summary: Retrieve Immutable Audit Trail Logs
 *     tags: [System Governance & Audit]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated audit log records
 */
router.get('/audit-logs', protect, admin, systemController.getAuditLogs);

export default router;
