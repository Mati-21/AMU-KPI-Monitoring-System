import { prisma } from '../../config/database.js';

export const getDocumentTypes = async () => {
  // TODO: Implement getDocumentTypes
  return [];
};

export const createDocument = async (data) => {
  // TODO: Implement createDocument
  return null;
};

export const linkEvidence = async (data) => {
  // TODO: Implement linkEvidence
  return null;
};

export const getLinkedEvidence = async (entityType, entityId) => {
  // TODO: Implement getLinkedEvidence
  return [];
};

export const unlinkEvidence = async (id) => {
  // TODO: Implement unlinkEvidence
  return null;
};

export default {
  getDocumentTypes,
  createDocument,
  linkEvidence,
  getLinkedEvidence,
  unlinkEvidence,
};
