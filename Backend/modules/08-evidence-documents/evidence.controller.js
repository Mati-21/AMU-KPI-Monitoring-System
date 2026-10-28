import * as evidenceService from './evidence.service.js';

export const getDocumentTypes = async (req, res, next) => {
  try {
    const types = await evidenceService.getDocumentTypes();
    res.json({ status: 'success', data: types });
  } catch (error) {
    next(error);
  }
};

export const createDocument = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Create document ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const linkEvidence = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Link evidence ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const getLinkedEvidence = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: [] });
  } catch (error) {
    next(error);
  }
};

export const unlinkEvidence = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Unlink evidence ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getDocumentTypes,
  createDocument,
  linkEvidence,
  getLinkedEvidence,
  unlinkEvidence,
};
