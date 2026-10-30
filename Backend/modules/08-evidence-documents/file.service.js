import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { updateSettingsGroup } from '../10-system-governance/system.service.js';
import { LOGO_EXTENSIONS, cleanFileName, extensionOf, matchesExtension } from './file.rules.js';
import { absolutePathOf, checksumOf, fileExists, removeFile, saveFile } from './file.storage.js';

/**
 * Module 08 — Stored files. Every download goes through a check here; nothing under uploads/ is served directly.
 */

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Validate the file's real type, write it to disk and register it. The disk copy is removed if registering fails.
 */
export const storeFile = async (upload, folder, allowedExtensions, personId) => {
  if (!upload) throw badRequest('A file is required (multipart field "file")');
  const originalName = cleanFileName(upload.originalname);
  const extension = extensionOf(originalName);
  if (!allowedExtensions.includes(extension)) throw badRequest(`.${extension || '?'} files are not allowed here. Allowed: ${allowedExtensions.join(', ')}`);
  if (upload.size === 0) throw badRequest('The file is empty');
  if (!matchesExtension(upload.buffer, extension)) throw badRequest(`The file's contents do not match its .${extension} extension`);

  const storedPath = await saveFile(folder, extension, upload.buffer);
  try {
    return await prisma.fileUpload.create({
      data: { originalName, storedPath, mimeType: upload.mimetype, sizeBytes: upload.size, checksum: checksumOf(upload.buffer), uploadedByPersonId: personId },
    });
  } catch (error) {
    await removeFile(storedPath);
    throw error;
  }
};

const getFileOrThrow = async (id) => {
  const file = await prisma.fileUpload.findUnique({ where: { id: parseUuid(id, 'id') } });
  if (!file) throw notFound('File not found');
  return file;
};

/**
 * Offices a file belongs to: the owner of its documents and every office whose baseline, report or change request uses it.
 */
const officesUsingFile = async (fileId) => {
  const contractOffice = { assignment: { select: { contract: { select: { officeId: true } } } } };
  const documents = await prisma.document.findMany({
    where: { fileId },
    select: {
      ownerOfficeId: true,
      baselineEvidence: { select: { baseline: { select: contractOffice } } },
      changeRequestEvidence: { select: { changeRequest: { select: contractOffice } } },
      performanceEvidence: { select: { performanceValue: { select: { report: { select: { contract: { select: { officeId: true } } } } } } } },
    },
  });
  const offices = documents.flatMap((document) => [
    document.ownerOfficeId,
    ...document.baselineEvidence.map((row) => row.baseline.assignment.contract.officeId),
    ...document.changeRequestEvidence.map((row) => row.changeRequest.assignment.contract.officeId),
    ...document.performanceEvidence.map((row) => row.performanceValue.report.contract.officeId),
  ]);
  return [...new Set(offices.filter(Boolean))];
};

const assertCanDownload = async (file, actor) => {
  if (file.uploadedByPersonId === actor.personId) return;
  if (actor.access.canGlobally(PERMISSIONS.FILE_READ)) return;
  for (const officeId of await officesUsingFile(file.id)) {
    if (await actor.access.can(PERMISSIONS.FILE_READ, officeId)) return;
  }
  throw forbidden('You do not have access to this file');
};

const toDownload = async (file, inline = false) => {
  if (!(await fileExists(file.storedPath))) throw notFound('The stored file is missing');
  return { absolutePath: absolutePathOf(file.storedPath), fileName: file.originalName, mimeType: file.mimeType, inline };
};

export const getFileForDownload = async (id, actor) => {
  const file = await getFileOrThrow(id);
  await assertCanDownload(file, actor);
  await auditAction(actor, { action: 'FILE_DOWNLOADED', entityType: 'file_upload', entityId: file.id });
  return toDownload(file);
};

/**
 * No login needed, but only for a file that a public setting points at, such as the logo.
 * Anything else answers 404, so this route reveals nothing about other files.
 */
export const getPublicFile = async (id) => {
  const file = await getFileOrThrow(id);
  const isPublic = await prisma.systemSetting.findFirst({ where: { fileId: file.id, isPublic: true }, select: { id: true } });
  if (!isPublic) throw notFound('File not found');
  return toDownload(file, true);
};

/**
 * Upload the logo and point branding.logo at it. The previous logo file is removed.
 */
export const uploadLogo = async (upload, actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.SETTINGS_MANAGE)) throw forbidden('Changing the logo requires university-wide settings:manage authority');
  if (upload && upload.size > MAX_LOGO_BYTES) throw badRequest('The logo must be 5 MB or smaller');

  const previous = await prisma.systemSetting.findUnique({ where: { groupName_key: { groupName: 'branding', key: 'logo' } }, select: { file: true } });
  const file = await storeFile(upload, 'system-assets', LOGO_EXTENSIONS, actor.personId);
  try {
    await updateSettingsGroup('branding', { settings: [{ key: 'logo', value: file.id }] }, actor);
  } catch (error) {
    await prisma.fileUpload.delete({ where: { id: file.id } });
    await removeFile(file.storedPath);
    throw error;
  }

  if (previous?.file) {
    await prisma.fileUpload.delete({ where: { id: previous.file.id } });
    await removeFile(previous.file.storedPath);
  }
  return { fileId: file.id, originalName: file.originalName, sizeBytes: Number(file.sizeBytes) };
};

export default { storeFile, getFileForDownload, getPublicFile, uploadLogo };
