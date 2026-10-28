import * as evidenceService from './evidence.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const uploadFile = async (req, res) => {
  const file = await evidenceService.uploadFile(req.file, actorOf(req));
  res.status(201).json({ status: 'success', data: file });
};

export const downloadFile = async (req, res) => {
  const { absolutePath, originalName } = await evidenceService.getFileForDownload(req.params.id, actorOf(req));
  res.download(absolutePath, originalName);
};

export const listDocumentTypes = async (req, res) => {
  const documentTypes = await evidenceService.listDocumentTypes();
  res.json({ status: 'success', data: documentTypes });
};

export const createDocument = async (req, res) => {
  const document = await evidenceService.createDocument(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: document });
};

export const linkDocument = async (req, res) => {
  const link = await evidenceService.linkDocument(req.params.id, req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: link });
};

export const listEvidence = async (req, res) => {
  const evidence = await evidenceService.listEvidence(req.params.entityType, req.params.entityId, actorOf(req));
  res.json({ status: 'success', data: evidence });
};

export const unlinkDocument = async (req, res) => {
  await evidenceService.unlinkDocument(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Evidence link removed' });
};

export default {
  uploadFile,
  downloadFile,
  listDocumentTypes,
  createDocument,
  linkDocument,
  listEvidence,
  unlinkDocument,
};
