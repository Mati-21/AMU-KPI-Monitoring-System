import { Router } from 'express';
import * as targetController from './target.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Target Cascading
 *   description: Module 05 — Top-down KPI target decomposition across the office tree
 */

/**
 * @swagger
 * /api/v1/kpi-targets:
 *   get:
 *     summary: List targets with filters
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *       - { in: query, name: officeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: kpiId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [draft, assigned, accepted, revised] } }
 *     responses:
 *       200: { description: Targets }
 *   post:
 *     summary: Set a top-level institutional target
 *     tags: [Target Cascading]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fiscalYearId, kpiId, officeId, targetValue]
 *             properties:
 *               fiscalYearId: { type: integer, example: 1 }
 *               kpiId: { type: string, format: uuid }
 *               officeId: { type: string, format: uuid }
 *               baselineValue: { type: number, example: 120 }
 *               targetValue: { type: number, example: 250 }
 *               weight: { type: number, example: 1 }
 *     responses:
 *       201: { description: Created }
 */
router.get('/kpi-targets', protect, requirePermission(PERMISSIONS.TARGET_READ), targetController.listTargets);
router.post('/kpi-targets', protect, requirePermission(PERMISSIONS.TARGET_CREATE), targetController.createTarget);

/**
 * @swagger
 * /api/v1/kpi-targets/tree:
 *   get:
 *     summary: Target decomposition tree from institutional roots down to offices and people
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *       - { in: query, name: kpiId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Target tree }
 */
router.get('/kpi-targets/tree', protect, requirePermission(PERMISSIONS.TARGET_READ), targetController.getTargetTree);

/**
 * @swagger
 * /api/v1/kpi-targets/my-targets:
 *   get:
 *     summary: Targets owned by or assigned to the current user's primary office
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: query, name: fiscalYearId, schema: { type: integer } }
 *     responses:
 *       200: { description: Targets }
 */
router.get('/kpi-targets/my-targets', protect, targetController.listMyTargets);

/**
 * @swagger
 * /api/v1/kpi-targets/{parentTargetId}/cascade:
 *   post:
 *     summary: Split a parent target into child targets (enforces maxOverAllocationPercent)
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: path, name: parentTargetId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [allocations]
 *             properties:
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [officeId, targetValue]
 *                   properties:
 *                     officeId: { type: string, format: uuid }
 *                     personId: { type: string, format: uuid }
 *                     targetValue: { type: number }
 *                     baselineValue: { type: number }
 *                     weight: { type: number }
 *     responses:
 *       201: { description: Child targets created }
 */
router.post('/kpi-targets/:parentTargetId/cascade', protect, requirePermission(PERMISSIONS.TARGET_CASCADE), targetController.cascadeTarget);

/**
 * @swagger
 * /api/v1/kpi-targets/{id}:
 *   put:
 *     summary: Update draft target values, baseline or weight
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baselineValue: { type: number }
 *               targetValue: { type: number }
 *               weight: { type: number }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/kpi-targets/:id', protect, requirePermission(PERMISSIONS.TARGET_UPDATE), targetController.updateTarget);

/**
 * @swagger
 * /api/v1/kpi-targets/{id}/status:
 *   patch:
 *     summary: Transition target status
 *     tags: [Target Cascading]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, assigned, accepted, revised] }
 *     responses:
 *       200: { description: Status updated }
 */
router.patch('/kpi-targets/:id/status', protect, requirePermission(PERMISSIONS.TARGET_ASSIGN), targetController.updateTargetStatus);

export default router;
