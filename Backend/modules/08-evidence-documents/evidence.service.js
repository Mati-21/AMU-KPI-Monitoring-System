import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Files =====

/**
 * Persist an uploaded binary (multipart `file`), compute its checksum and register a File record.
 */
export const uploadFile = async (file, actor) => notImplemented('uploadFile');

/**
 * Resolve a File for streaming after permission and confidentiality checks.
 */
export const getFileForDownload = async (id, actor) => notImplemented('getFileForDownload');

// ===== Document types & documents =====

export const listDocumentTypes = async () => notImplemented('listDocumentTypes');

export const createDocument = async ({ documentTypeId, fileId, ownerOfficeId, title, description, isConfidential }, actor) =>
  notImplemented('createDocument');

// ===== Evidence links (polymorphic) =====

export const linkDocument = async (documentId, { entityType, entityId }, actor) => notImplemented('linkDocument');

export const listEvidence = async (entityType, entityId, actor) => notImplemented('listEvidence');

export const unlinkDocument = async (linkId, actor) => notImplemented('unlinkDocument');

export default {
  uploadFile,
  getFileForDownload,
  listDocumentTypes,
  createDocument,
  linkDocument,
  listEvidence,
  unlinkDocument,
};
