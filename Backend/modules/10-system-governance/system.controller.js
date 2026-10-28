import * as systemService from './system.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const getPublicSettings = async (req, res) => {
  const settings = await systemService.getPublicSettings();
  res.json({ status: 'success', data: settings });
};

export const getSettingsGrouped = async (req, res) => {
  const settings = await systemService.getSettingsGrouped();
  res.json({ status: 'success', data: settings });
};

export const updateSettingsGroup = async (req, res) => {
  const settings = await systemService.updateSettingsGroup(req.params.groupName, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: settings });
};

export const listAuditLogs = async (req, res) => {
  const { actorPersonId, action, entityType, from, to, page, limit } = req.query;
  const result = await systemService.listAuditLogs({ actorPersonId, action, entityType, from, to, page, limit });
  res.json({ status: 'success', ...result });
};

export const getAuditLogById = async (req, res) => {
  const log = await systemService.getAuditLogById(req.params.id);
  res.json({ status: 'success', data: log });
};

export default {
  getPublicSettings,
  getSettingsGrouped,
  updateSettingsGroup,
  listAuditLogs,
  getAuditLogById,
};
