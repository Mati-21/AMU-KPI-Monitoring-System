import { Router } from 'express';
import * as evidenceController from './evidence.controller.js';
import { uploadOneFile } from './upload.middleware.js';
import { protect, requirePermission } from '../../middleware/authMiddleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = Router();
const canManageTypes = requirePermission(PERMISSIONS.DOCUMENT_MANAGE);
const canCreateDocuments = requirePermission(PERMISSIONS.DOCUMENT_CREATE);
const canReadFiles = requirePermission(PERMISSIONS.FILE_READ);

/**
 * @swagger
 * tags:
 *   name: Evidence & Documents
 *   description: Module 08 — File uploads and downloads, document types, documents and performance evidence
 */

// ===== Files =====

/**
 * @swagger
 * /api/v1/files/{id}/download:
 *   get:
 *     summary: Download a file you have access to
 *     description: Access needs file:read over an office that owns or uses the file, or having uploaded it. Downloads are audited.
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The file }
 *       403: { description: No access }
 *       404: { description: File not found }
 * /api/v1/files/{id}/public:
 *   get:
 *     summary: Show a file that a public setting points at, such as the logo. No login needed
 *     tags: [Evidence & Documents]
 *     security: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The file }
 *       404: { description: Not found, or not public }
 * /api/v1/files/logo:
 *   post:
 *     summary: Upload the university logo and set branding.logo (png, jpg or webp, up to 5 MB)
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
 *       201: { description: "{ fileId, originalName, sizeBytes }" }
 *       400: { description: Not an allowed image }
 */
router.get('/files/:id/download', protect, requirePermission(PERMISSIONS.FILE_READ, PERMISSIONS.DOCUMENT_CREATE), evidenceController.downloadFile);
router.get('/files/:id/public', evidenceController.getPublicFile);
router.post('/files/logo', protect, requirePermission(PERMISSIONS.SETTINGS_MANAGE), uploadOneFile, evidenceController.uploadLogo);

// ===== Document types =====

/**
 * @swagger
 * /api/v1/document-types:
 *   get:
 *     summary: Document types with their allowed file types and size limits
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       200: { description: Document types }
 *   post:
 *     summary: Create a document type
 *     tags: [Evidence & Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Financial Statement }
 *               description: { type: string }
 *               allowedExtensions: { type: string, example: "pdf,xlsx", description: Empty allows every supported type }
 *               maxSizeMb: { type: integer, example: 25 }
 *     responses:
 *       201: { description: Created }
 * /api/v1/document-types/{id}:
 *   put:
 *     summary: Update or retire a document type
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               allowedExtensions: { type: string }
 *               maxSizeMb: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.get('/document-types', protect, evidenceController.listDocumentTypes);
router.post('/document-types', protect, canManageTypes, evidenceController.createDocumentType);
router.put('/document-types/:id', protect, canManageTypes, evidenceController.updateDocumentType);

// ===== Documents =====

/**
 * @swagger
 * /api/v1/documents:
 *   get:
 *     summary: Documents of offices in your scope, and those you uploaded
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: query, name: ownerOfficeId, schema: { type: string, format: uuid } }
 *       - { in: query, name: documentTypeId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Documents }
 *   post:
 *     summary: Upload a file and describe it, against the rules of its document type
 *     description: The file's real contents are checked against its extension.
 *     tags: [Evidence & Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, documentTypeId, ownerOfficeId, title]
 *             properties:
 *               file: { type: string, format: binary }
 *               documentTypeId: { type: string, format: uuid }
 *               ownerOfficeId: { type: string, format: uuid }
 *               title: { type: string, example: Q1 publication list }
 *               description: { type: string }
 *     responses:
 *       201: { description: Uploaded }
 *       400: { description: File type, size or contents not allowed }
 * /api/v1/documents/{id}:
 *   get:
 *     summary: One document
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Document }
 *   delete:
 *     summary: Delete a document and its file, unless it is used as evidence
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: Used as evidence }
 */
router.get('/documents', protect, canReadFiles, evidenceController.listDocuments);
router.post('/documents', protect, canCreateDocuments, uploadOneFile, evidenceController.createDocument);
router.get('/documents/:id', protect, canReadFiles, evidenceController.getDocumentById);
router.delete('/documents/:id', protect, canCreateDocuments, evidenceController.deleteDocument);

// ===== Performance evidence =====

/**
 * @swagger
 * /api/v1/performance-values/{id}/evidence:
 *   get:
 *     summary: Evidence behind a reported result
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Evidence with verification status }
 *   post:
 *     summary: Attach a document of the reporting office to a result, while the report can still change
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documentId]
 *             properties:
 *               documentId: { type: string, format: uuid }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Attached }
 *       409: { description: Report or period no longer open }
 * /api/v1/performance-evidence/{id}:
 *   delete:
 *     summary: Remove evidence while the report can still change
 *     tags: [Evidence & Documents]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed }
 * /api/v1/performance-evidence/{id}/verify:
 *   patch:
 *     summary: Verify or reject evidence during review. A rejection needs a comment
 *     tags: [Evidence & Documents]
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
 *               status: { type: string, enum: [VERIFIED, REJECTED] }
 *               comment: { type: string }
 *     responses:
 *       200: { description: Reviewed }
 */
router.get('/performance-values/:id/evidence', protect, requirePermission(PERMISSIONS.EVIDENCE_READ), evidenceController.listEvidence);
router.post('/performance-values/:id/evidence', protect, requirePermission(PERMISSIONS.EVIDENCE_LINK), evidenceController.attachEvidence);
router.delete('/performance-evidence/:id', protect, requirePermission(PERMISSIONS.EVIDENCE_LINK), evidenceController.removeEvidence);
router.patch('/performance-evidence/:id/verify', protect, requirePermission(PERMISSIONS.EVIDENCE_VERIFY), evidenceController.verifyEvidence);

export default router;
