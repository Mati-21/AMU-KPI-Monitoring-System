import { Router } from 'express';
import * as evidenceController from './evidence.controller.js';
import { protect, admin } from '../../middleware/authMiddleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evidence & Documents
 *   description: Document Registry & Polymorphic Evidence Proof Linking (Module 08 - Platform)
 */

/**
 * @swagger
 * /api/evidence/types:
 *   get:
 *     summary: List Approved Evidence Document Types
 *     tags: [Evidence & Documents]
 *     security:
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: List of document taxonomy types
 */
router.get('/types', protect, evidenceController.getDocumentTypes);

/**
 * @swagger
 * /api/evidence:
 *   post:
 *     summary: Register Document Metadata Wrapping a Stored File
 *     tags: [Evidence & Documents]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentTypeId
 *               - fileId
 *               - title
 *             properties:
 *               documentTypeId:
 *                 type: integer
 *               fileId:
 *                 type: string
 *               title:
 *                 type: string
 *                 example: IEEE Publication Acceptance Certificate
 *               description:
 *                 type: string
 *               ownerOfficeId:
 *                 type: string
 *               isConfidential:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Document metadata registered
 */
router.post('/', protect, evidenceController.createDocument);

/**
 * @swagger
 * /api/evidence/link:
 *   post:
 *     summary: Polymorphically Attach a Document as Proof to a KPI Evaluation or Cycle Report
 *     tags: [Evidence & Documents]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - entityType
 *               - entityId
 *             properties:
 *               documentId:
 *                 type: string
 *               entityType:
 *                 type: string
 *                 example: kpi_evaluation
 *               entityId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Evidence linked
 */
router.post('/link', protect, evidenceController.linkEvidence);

/**
 * @swagger
 * /api/evidence/{entityType}/{entityId}:
 *   get:
 *     summary: Retrieve All Evidence Documents Attached to an Entity
 *     tags: [Evidence & Documents]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           example: kpi_evaluation
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of attached documents
 */
router.get('/:entityType/:entityId', protect, evidenceController.getLinkedEvidence);

/**
 * @swagger
 * /api/evidence/links/{id}:
 *   delete:
 *     summary: Remove an Evidence Link
 *     tags: [Evidence & Documents]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Link removed
 */
router.delete('/links/:id', protect, evidenceController.unlinkEvidence);

export default router;
