import { Router } from 'express';
import * as evidenceController from './evidence.controller.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Evidence & Documents
 *   description: Module 08 — File storage, document metadata and polymorphic evidence links
 */

/**
 * @swagger
 * /api/v1/files/upload:
 *   post:
 *     summary: Upload a binary file (multipart field `file`)
 *     tags: [Evidence & Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: File registered }
 */
router.post('/files/upload', protect, requirePermission(PERMISSIONS.FILE_UPLOAD), evidenceController.uploadFile);

/**
 * @swagger
 * /api/v1/files/{id}/download:
 *   get:
 *     summary: Stream a file after permission and confidentiality checks
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Binary stream }
 */
router.get('/files/:id/download', protect, requirePermission(PERMISSIONS.FILE_READ), evidenceController.downloadFile);

/**
 * @swagger
 * /api/v1/document-types:
 *   get:
 *     summary: Accepted evidence document types and upload constraints
 *     tags: [Evidence & Documents]
 *     responses:
 *       200: { description: Document types }
 */
router.get('/document-types', protect, evidenceController.listDocumentTypes);

/**
 * @swagger
 * /api/v1/documents:
 *   post:
 *     summary: Register document metadata for an uploaded file
 *     tags: [Evidence & Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentTypeId, fileId, title]
 *             properties:
 *               documentTypeId: { type: integer }
 *               fileId: { type: string, format: uuid }
 *               ownerOfficeId: { type: string, format: uuid }
 *               title: { type: string, example: Q1 graduation list }
 *               description: { type: string }
 *               isConfidential: { type: boolean, default: false }
 *     responses:
 *       201: { description: Document created }
 */
router.post('/documents', protect, requirePermission(PERMISSIONS.DOCUMENT_CREATE), evidenceController.createDocument);

/**
 * @swagger
 * /api/v1/documents/{id}/link:
 *   post:
 *     summary: Attach a document as evidence to an entity (kpi_evaluation, cycle_report, kpi_target)
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, entityId]
 *             properties:
 *               entityType: { type: string, enum: [kpi_evaluation, cycle_report, kpi_target] }
 *               entityId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Linked }
 */
router.post('/documents/:id/link', protect, requirePermission(PERMISSIONS.EVIDENCE_LINK), evidenceController.linkDocument);

/**
 * @swagger
 * /api/v1/evidence/{entityType}/{entityId}:
 *   get:
 *     summary: Evidence documents attached to an entity
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: entityType, required: true, schema: { type: string, enum: [kpi_evaluation, cycle_report, kpi_target] } }
 *       - { in: path, name: entityId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Evidence }
 */
router.get('/evidence/:entityType/:entityId', protect, requirePermission(PERMISSIONS.EVIDENCE_READ), evidenceController.listEvidence);

/**
 * @swagger
 * /api/v1/document-links/{id}:
 *   delete:
 *     summary: Remove an evidence link
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed }
 */
router.delete('/document-links/:id', protect, requirePermission(PERMISSIONS.EVIDENCE_LINK), evidenceController.unlinkDocument);

export default router;
