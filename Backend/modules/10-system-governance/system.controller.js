import * as systemService from './system.service.js';

export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await systemService.getPublicSettings();
    res.json({ status: 'success', data: settings });
  } catch (error) {
    next(error);
  }
};

export const getAllSettings = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: {} });
  } catch (error) {
    next(error);
  }
};

export const upsertSetting = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Upsert setting ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    res.json({ status: 'success', total: 0, data: [] });
  } catch (error) {
    next(error);
  }
};

export default {
  getPublicSettings,
  getAllSettings,
  upsertSetting,
  getAuditLogs,
};
