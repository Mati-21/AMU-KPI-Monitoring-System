import { Router } from 'express';
import * as systemController from './system.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: System Governance
 *   description: Module 10 — Grouped system settings and the immutable audit trail
 */

/**
 * @swagger
 * /api/v1/settings/public:
 *   get:
 *     summary: Public institutional configuration (university name, active fiscal year, logo)
 *     tags: [System Governance]
 *     security: []
 *     responses:
 *       200: { description: Public settings }
 */
router.get('/settings/public', systemController.getPublicSettings);

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: All system settings grouped by groupName
 *     tags: [System Governance]
 *     responses:
 *       200: { description: Settings }
 */
router.get('/settings', protect, requirePermission(PERMISSIONS.SETTINGS_MANAGE), systemController.getSettingsGrouped);

/**
 * @swagger
 * /api/v1/settings/{groupName}:
 *   put:
 *     summary: Batch update key/value settings within a group
 *     tags: [System Governance]
 *     parameters:
 *       - { in: path, name: groupName, required: true, schema: { type: string, example: branding } }
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
 *                   required: [key]
 *                   properties:
 *                     key: { type: string, example: university_name }
 *                     value: { type: string, example: Arba Minch University }
 *                     valueType: { type: string, enum: [text, number, boolean, json, file], default: text }
 *                     fileId: { type: string, format: uuid }
 *                     description: { type: string }
 *                     isPublic: { type: boolean, default: false }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/settings/:groupName', protect, requirePermission(PERMISSIONS.SETTINGS_MANAGE), systemController.updateSettingsGroup);

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: Query the audit trail
 *     tags: [System Governance]
 *     parameters:
 *       - { in: query, name: actorPersonId, schema: { type: string, format: uuid } }
 *       - { in: query, name: action, schema: { type: string } }
 *       - { in: query, name: entityType, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Audit log page }
 */
router.get('/audit-logs', protect, requirePermission(PERMISSIONS.AUDIT_READ), systemController.listAuditLogs);

/**
 * @swagger
 * /api/v1/audit-logs/{id}:
 *   get:
 *     summary: Full audit entry with oldValues/newValues
 *     tags: [System Governance]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Audit entry }
 */
router.get('/audit-logs/:id', protect, requirePermission(PERMISSIONS.AUDIT_READ), systemController.getAuditLogById);

export default router;
