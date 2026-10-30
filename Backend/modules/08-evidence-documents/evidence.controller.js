import * as fileService from './file.service.js';
import * as documentService from './document.service.js';
import * as evidenceService from './evidence.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

// Always sent as a download, or inline only for public images, with the type fixed so a browser cannot run it
const sendStoredFile = (res, { absolutePath, fileName, mimeType, inline }) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(mimeType);
  if (inline) return res.sendFile(absolutePath);
  return res.download(absolutePath, fileName);
};

// ===== Files =====
export const downloadFile = async (req, res) => sendStoredFile(res, await fileService.getFileForDownload(req.params.id, actorOf(req)));
export const getPublicFile = async (req, res) => sendStoredFile(res, await fileService.getPublicFile(req.params.id));
export const uploadLogo = async (req, res) => send(res, await fileService.uploadLogo(req.file, actorOf(req)), 201);

// ===== Document types =====
export const listDocumentTypes = async (req, res) => send(res, await documentService.listDocumentTypes({ isActive: req.query.isActive }));
export const createDocumentType = async (req, res) => send(res, await documentService.createDocumentType(req.body || {}, actorOf(req)), 201);
export const updateDocumentType = async (req, res) => send(res, await documentService.updateDocumentType(req.params.id, req.body || {}, actorOf(req)));

// ===== Documents =====
export const createDocument = async (req, res) => send(res, await documentService.createDocument(req.file, req.body || {}, actorOf(req)), 201);
export const listDocuments = async (req, res) => {
  const { ownerOfficeId, documentTypeId } = req.query;
  send(res, await documentService.listDocuments({ ownerOfficeId, documentTypeId }, actorOf(req)));
};
export const getDocumentById = async (req, res) => send(res, await documentService.getDocumentById(req.params.id, actorOf(req)));
export const deleteDocument = async (req, res) => {
  await documentService.deleteDocument(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Document deleted' });
};

// ===== Performance evidence =====
export const listEvidence = async (req, res) => send(res, await evidenceService.listEvidence(req.params.id, actorOf(req)));
export const attachEvidence = async (req, res) => send(res, await evidenceService.attachEvidence(req.params.id, req.body || {}, actorOf(req)), 201);
export const removeEvidence = async (req, res) => {
  await evidenceService.removeEvidence(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Evidence removed' });
};
export const verifyEvidence = async (req, res) => send(res, await evidenceService.verifyEvidence(req.params.id, req.body || {}, actorOf(req)));
