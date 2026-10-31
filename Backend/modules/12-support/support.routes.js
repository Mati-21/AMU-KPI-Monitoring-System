import { Router } from 'express';
import * as supportController from './support.controller.js';
import { limitRequestsPerHour } from '../../middleware/attemptLimiter.js';
import { optionalAuth, protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canManage = requirePermission(PERMISSIONS.SUPPORT_MANAGE);

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Module 12 — Requests sent to the administrators, including by people who cannot log in
 * /api/v1/support-requests:
 *   post:
 *     summary: Send a message to the administrators. No login needed
 *     description: Limited per address by the security.support_requests_per_hour setting.
 *     tags: [Support]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string }
 *               message: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Received }
 *       429: { description: Too many requests from this address }
 *   get:
 *     summary: Support requests, newest first, with counts by status
 *     tags: [Support]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [NEW, IN_PROGRESS, RESOLVED] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 100 } }
 *     responses:
 *       200: { description: "{ requests, counts, pagination }" }
 * /api/v1/support-requests/{id}:
 *   get:
 *     summary: One support request
 *     tags: [Support]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The request }
 *   patch:
 *     summary: Change a request's status or resolution note. Resolved requests can be reopened
 *     tags: [Support]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [NEW, IN_PROGRESS, RESOLVED] }
 *               resolutionNote: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.post('/support-requests', optionalAuth, limitRequestsPerHour('support', 'support_requests_per_hour'), supportController.createSupportRequest);
router.get('/support-requests', protect, canManage, supportController.listSupportRequests);
router.get('/support-requests/:id', protect, canManage, supportController.getSupportRequest);
router.patch('/support-requests/:id', protect, canManage, supportController.updateSupportRequest);

export default router;
