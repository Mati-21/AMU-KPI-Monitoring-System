import { Router } from 'express';
import * as systemController from './system.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: System Governance
 *   description: Module 10 — System settings (registry in config/settings.json), maintenance mode and the audit trail
 */

/**
 * @swagger
 * /api/v1/settings/public:
 *   get:
 *     summary: Public configuration (branding, contact, calendar, maintenance status, active fiscal year)
 *     description: No login required. File settings (e.g. branding.logo) return the File id.
 *     tags: [System Governance]
 *     security: []
 *     responses:
 *       200: { description: "{ branding: {...}, general: {...}, system: { maintenance_mode, ... }, activeFiscalYear }" }
 */
router.get('/settings/public', systemController.getPublicSettings);

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: All settings grouped, with typed value, default, constraints and last change (university-wide settings:manage)
 *     tags: [System Governance]
 *     responses:
 *       200: { description: Setting groups }
 */
router.get('/settings', protect, requirePermission(PERMISSIONS.SETTINGS_MANAGE), systemController.getSettingsGrouped);

/**
 * @swagger
 * /api/v1/settings/{groupName}:
 *   put:
 *     summary: Change settings of one group (value null resets a key to its default)
 *     description: |
 *       Only keys declared in config/settings.json are accepted; type, visibility and description come from the registry.
 *       All entries are validated before anything is saved. Groups: branding, general, kpi, reporting, system.
 *     tags: [System Governance]
 *     parameters:
 *       - { in: path, name: groupName, required: true, schema: { type: string, enum: [branding, general, kpi, reporting, system] } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settings]
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, value]
 *                   properties:
 *                     key: { type: string, example: submission_window_days }
 *                     value: { description: "Typed value (text, number, boolean, list...) or null to reset", example: 20 }
 *           examples:
 *             reporting:
 *               summary: Reporting deadlines
 *               value: { settings: [{ key: submission_window_days, value: 20 }, { key: reminder_days_before_deadline, value: [10, 3, 1] }] }
 *             maintenance:
 *               summary: Turn maintenance mode on
 *               value: { settings: [{ key: maintenance_mode, value: true }, { key: maintenance_ends_at, value: "2026-11-01T18:00:00Z" }] }
 *     responses:
 *       200: { description: Updated group with changedKeys }
 *       400: { description: "Invalid values; details.errors lists every problem" }
 *       404: { description: Unknown group }
 */
router.put('/settings/:groupName', protect, requirePermission(PERMISSIONS.SETTINGS_MANAGE), systemController.updateSettingsGroup);

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: Query the audit trail (newest first, university-wide audit:read)
 *     tags: [System Governance]
 *     parameters:
 *       - { in: query, name: actorPersonId, schema: { type: string, format: uuid } }
 *       - { in: query, name: action, schema: { type: string, example: OFFICE_UPDATED } }
 *       - { in: query, name: entityType, schema: { type: string, example: office } }
 *       - { in: query, name: entityId, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date }, description: Inclusive (whole day) }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200: { description: "{ data: [{ ..., actor, changedFields }], pagination }" }
 */
router.get('/audit-logs', protect, requirePermission(PERMISSIONS.AUDIT_READ), systemController.listAuditLogs);

/**
 * @swagger
 * /api/v1/audit-logs/filters:
 *   get:
 *     summary: Distinct actions, entity types and actors for audit filter dropdowns
 *     tags: [System Governance]
 *     responses:
 *       200: { description: "{ actions, entityTypes, actors }" }
 */
router.get('/audit-logs/filters', protect, requirePermission(PERMISSIONS.AUDIT_READ), systemController.getAuditFilters);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   get:
 *     summary: Full audit entry with a field-by-field diff of oldValues and newValues
 *     tags: [System Governance]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "Entry with changes: [{ field, old, new }]" }
 */
router.get('/audit-logs/:id', protect, requirePermission(PERMISSIONS.AUDIT_READ), systemController.getAuditLogById);

export default router;
