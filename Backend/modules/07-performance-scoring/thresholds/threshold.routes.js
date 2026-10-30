import { Router } from 'express';
import * as thresholdController from './threshold.controller.js';
import { protect, requirePermission } from '../../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../../config/permissions.js';

const router = Router();
const canManage = requirePermission(PERMISSIONS.SCORECARD_MANAGE);

/**
 * @swagger
 * /api/v1/performance-thresholds:
 *   get:
 *     summary: The university's performance bands
 *     tags: [Performance Scoring]
 *     responses:
 *       200: { description: Bands }
 *   post:
 *     summary: Create a performance band
 *     tags: [Performance Scoring]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, minPercent]
 *             properties:
 *               name: { type: string, example: Near Target }
 *               minPercent: { type: number, example: 80 }
 *               maxPercent: { type: number, example: 99.99 }
 *               color: { type: string, example: "#ca8a04" }
 *               sortOrder: { type: integer }
 *     responses:
 *       201: { description: Created }
 * /api/v1/performance-thresholds/{id}:
 *   put:
 *     summary: Update or retire a band. Saved results keep the band they were given
 *     tags: [Performance Scoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               minPercent: { type: number }
 *               maxPercent: { type: number, nullable: true }
 *               color: { type: string }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.get('/performance-thresholds', protect, thresholdController.listThresholds);
router.post('/performance-thresholds', protect, canManage, thresholdController.createThreshold);
router.put('/performance-thresholds/:id', protect, canManage, thresholdController.updateThreshold);

export default router;
