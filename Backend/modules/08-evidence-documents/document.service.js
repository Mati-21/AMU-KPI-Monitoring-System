import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseBooleanQuery, parseNumber, parseUuid, requireString } from '../../utils/validation.js';
import { KNOWN_EXTENSIONS, parseExtensionList } from './file.rules.js';
import { removeFile } from './file.storage.js';
import { storeFile } from './file.service.js';

/**
 * Module 08 — Document types (what the university accepts) and documents (an uploaded file with its description).
 */

// ===== Document types =====

const assertCanManageTypes = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.DOCUMENT_MANAGE)) throw forbidden('Managing document types requires university-wide document:manage authority');
};

/**
 * Normalize an extension list, refusing types whose contents cannot be checked.
 */
const parseAllowedExtensions = (text) => {
  const extensions = parseExtensionList(optionalString(text, 'allowedExtensions'));
  const unknown = extensions.filter((extension) => !KNOWN_EXTENSIONS.includes(extension));
  if (unknown.length > 0) throw badRequest(`Unsupported file types: ${unknown.join(', ')}. Supported: ${KNOWN_EXTENSIONS.join(', ')}`);
  return extensions.length > 0 ? [...new Set(extensions)].join(',') : null;
};

const parseMaxSize = (value) => {
  const size = parseNumber(value, 'maxSizeMb', { integer: true });
  if (size !== undefined && size < 1) throw badRequest('maxSizeMb must be at least 1');
  return size;
};

export const listDocumentTypes = ({ isActive } = {}) => {
  const active = parseBooleanQuery(isActive, 'isActive');
  return prisma.documentType.findMany({ where: active === undefined ? {} : { isActive: active }, orderBy: { name: 'asc' } });
};

export const createDocumentType = async ({ name, description, allowedExtensions, maxSizeMb } = {}, actor) => {
  assertCanManageTypes(actor);
  const documentType = await prisma.documentType.create({
    data: {
      name: requireString(name, 'name'),
      description: optionalString(description, 'description') ?? null,
      allowedExtensions: parseAllowedExtensions(allowedExtensions),
      maxSizeMb: parseMaxSize(maxSizeMb) ?? null,
    },
  });
  await auditAction(actor, { action: 'DOCUMENT_TYPE_CREATED', entityType: 'document_type', entityId: documentType.id, newValues: documentType });
  return documentType;
};

export const updateDocumentType = async (id, data = {}, actor) => {
  assertCanManageTypes(actor);
  const existing = await prisma.documentType.findUnique({ where: { id: parseUuid(id, 'id') } });
  if (!existing) throw notFound('Document type not found');

  const update = {};
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.description !== undefined) update.description = optionalString(data.description, 'description');
  if (data.allowedExtensions !== undefined) update.allowedExtensions = parseAllowedExtensions(data.allowedExtensions);
  if (data.maxSizeMb !== undefined) update.maxSizeMb = parseMaxSize(data.maxSizeMb) ?? null;
  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined) update.isActive = isActive;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const documentType = await prisma.documentType.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'DOCUMENT_TYPE_UPDATED', entityType: 'document_type', entityId: existing.id, oldValues: existing, newValues: documentType });
  return documentType;
};

// ===== Documents =====

const DOCUMENT_INCLUDE = {
  documentType: { select: { id: true, name: true } },
  ownerOffice: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, checksum: true, uploadedAt: true } },
};

// size_bytes is a BigInt, which JSON cannot represent
const formatDocument = ({ file, ...document }) => ({ ...document, file: { ...file, sizeBytes: Number(file.sizeBytes) } });

const canRead = async (actor, document) => document.createdByPersonId === actor.personId || (document.ownerOfficeId && actor.access.can(PERMISSIONS.FILE_READ, document.ownerOfficeId));

/**
 * Upload a file and describe it in one step, against the rules of its document type.
 */
export const createDocument = async (upload, { documentTypeId, ownerOfficeId, title, description } = {}, actor) => {
  const officeId = parseUuid(ownerOfficeId, 'ownerOfficeId');
  if (!(await actor.access.can(PERMISSIONS.DOCUMENT_CREATE, officeId))) throw forbidden('You can upload documents only for offices in your scope');
  if (!(await prisma.office.findUnique({ where: { id: officeId }, select: { id: true } }))) throw badRequest('Office not found');

  const documentType = await prisma.documentType.findUnique({ where: { id: parseUuid(documentTypeId, 'documentTypeId') } });
  if (!documentType) throw badRequest('Document type not found');
  if (!documentType.isActive) throw badRequest(`Document type "${documentType.name}" is no longer in use`);
  if (upload && documentType.maxSizeMb && upload.size > documentType.maxSizeMb * 1024 * 1024) {
    throw badRequest(`"${documentType.name}" files can be at most ${documentType.maxSizeMb} MB`);
  }

  const cleanTitle = requireString(title, 'title');
  const allowed = documentType.allowedExtensions ? parseExtensionList(documentType.allowedExtensions) : KNOWN_EXTENSIONS;
  const file = await storeFile(upload, 'documents', allowed, actor.personId);

  const document = await prisma.document.create({
    data: { documentTypeId: documentType.id, fileId: file.id, ownerOfficeId: officeId, title: cleanTitle, description: optionalString(description, 'description') ?? null, createdByPersonId: actor.personId },
    include: DOCUMENT_INCLUDE,
  });
  await auditAction(actor, {
    action: 'DOCUMENT_UPLOADED',
    entityType: 'document',
    entityId: document.id,
    newValues: { title: cleanTitle, documentType: documentType.name, ownerOfficeId: officeId, fileName: file.originalName, checksum: file.checksum },
  });
  return formatDocument(document);
};

export const listDocuments = async ({ ownerOfficeId, documentTypeId } = {}, actor) => {
  const documents = await prisma.document.findMany({
    where: {
      ...(ownerOfficeId && { ownerOfficeId: parseUuid(ownerOfficeId, 'ownerOfficeId') }),
      ...(documentTypeId && { documentTypeId: parseUuid(documentTypeId, 'documentTypeId') }),
    },
    orderBy: { createdAt: 'desc' },
    include: DOCUMENT_INCLUDE,
  });
  const visible = [];
  for (const document of documents) {
    if (await canRead(actor, document)) visible.push(formatDocument(document));
  }
  return visible;
};

export const getDocumentById = async (id, actor) => {
  const document = await prisma.document.findUnique({ where: { id: parseUuid(id, 'id') }, include: DOCUMENT_INCLUDE });
  if (!document || !(await canRead(actor, document))) throw notFound('Document not found');
  return formatDocument(document);
};

/**
 * Delete a document uploaded by mistake, with its file. Refused once it supports a baseline, result or change request.
 */
export const deleteDocument = async (id, actor) => {
  const document = await prisma.document.findUnique({
    where: { id: parseUuid(id, 'id') },
    include: { file: true, _count: { select: { baselineEvidence: true, performanceEvidence: true, changeRequestEvidence: true } } },
  });
  if (!document) throw notFound('Document not found');

  const mayDelete = document.createdByPersonId === actor.personId || (document.ownerOfficeId && (await actor.access.can(PERMISSIONS.DOCUMENT_CREATE, document.ownerOfficeId)));
  if (!mayDelete) throw forbidden('You cannot delete this document');
  if (Object.values(document._count).some((count) => count > 0)) throw conflict('This document is used as evidence and cannot be deleted');

  await prisma.$transaction([prisma.document.delete({ where: { id: document.id } }), prisma.fileUpload.delete({ where: { id: document.fileId } })]);
  await removeFile(document.file.storedPath);
  await auditAction(actor, {
    action: 'DOCUMENT_DELETED',
    entityType: 'document',
    entityId: document.id,
    oldValues: { title: document.title, fileName: document.file.originalName, checksum: document.file.checksum },
  });
};

export default { listDocumentTypes, createDocumentType, updateDocumentType, createDocument, listDocuments, getDocumentById, deleteDocument };
