import { Router } from 'express';
import * as targetController from './target.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Target Cascading
 *   description: Institutional Goal Allocation, Splitting & Cascading (Module 05 - Operations)
 */

/**
 * @swagger
 * /api/targets:
 *   get:
 *     summary: List KPI Targets Filtered by Fiscal Year, Office, and KPI
 *     tags: [Target Cascading]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: fiscalYearId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: officeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: kpiId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, assigned, accepted, revised]
 *     responses:
 *       200:
 *         description: List of targets
 *   post:
 *     summary: Create Top-Level Institutional KPI Target
 *     tags: [Target Cascading]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fiscalYearId
 *               - kpiId
 *               - officeId
 *               - targetValue
 *             properties:
 *               fiscalYearId:
 *                 type: integer
 *                 example: 1
 *               kpiId:
 *                 type: string
 *                 example: kpi-uuid
 *               officeId:
 *                 type: string
 *                 example: amu-root-office-uuid
 *               baselineValue:
 *                 type: number
 *                 example: 120.0
 *               targetValue:
 *                 type: number
 *                 example: 250.0
 *               weight:
 *                 type: number
 *                 example: 1.0
 *     responses:
 *       201:
 *         description: Target created
 */
router.get('/', protect, targetController.getTargets);
router.post('/', protect, admin, targetController.createTarget);

/**
 * @swagger
 * /api/targets/tree:
 *   get:
 *     summary: Retrieve Hierarchical Target Decomposition Tree
 *     tags: [Target Cascading]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: fiscalYearId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: kpiId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Target tree structure
 */
router.get('/tree', protect, targetController.getTargetTree);

/**
 * @swagger
 * /api/targets/{id}/cascade:
 *   post:
 *     summary: Cascade a Parent Target to Child Sub-Offices
 *     description: Decomposes target into child targets, validating split math against maxOverAllocationPercent cap
 *     tags: [Target Cascading]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of parent target to cascade
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allocations
 *             properties:
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - officeId
 *                     - targetValue
 *                   properties:
 *                     officeId:
 *                       type: string
 *                     targetValue:
 *                       type: number
 *                     weight:
 *                       type: number
 *     responses:
 *       201:
 *         description: Successfully cascaded
 */
router.post('/:id/cascade', protect, admin, targetController.cascadeTarget);

/**
 * @swagger
 * /api/targets/{id}/status:
 *   patch:
 *     summary: Transition Target Status (draft, assigned, accepted, revised)
 *     tags: [Target Cascading]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, assigned, accepted, revised]
 *     responses:
 *       200:
 *         description: Target status updated
 */
router.patch('/:id/status', protect, admin, targetController.updateStatus);

export default router;
