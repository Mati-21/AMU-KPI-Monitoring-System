import * as systemService from './system.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const getPublicSettings = async (req, res) => {
  const settings = await systemService.getPublicSettings();
  res.json({ status: 'success', data: settings });
};

export const getSettingsGrouped = async (req, res) => {
  const groups = await systemService.getSettingsGrouped(actorOf(req));
  res.json({ status: 'success', data: groups });
};

export const updateSettingsGroup = async (req, res) => {
  const group = await systemService.updateSettingsGroup(req.params.groupName, req.body || {}, actorOf(req));
  res.json({ status: 'success', message: `${group.changedKeys.length} setting(s) changed`, data: group });
};

export const listAuditLogs = async (req, res) => {
  const { actorPersonId, action, entityType, entityId, from, to, page, limit } = req.query;
  const result = await systemService.listAuditLogs({ actorPersonId, action, entityType, entityId, from, to, page, limit }, actorOf(req));
  res.json({ status: 'success', ...result });
};

export const getAuditFilters = async (req, res) => {
  const filters = await systemService.getAuditFilters(actorOf(req));
  res.json({ status: 'success', data: filters });
};

export const getAuditLogById = async (req, res) => {
  const log = await systemService.getAuditLogById(req.params.id, actorOf(req));
  res.json({ status: 'success', data: log });
};

export default {
  getPublicSettings,
  getSettingsGrouped,
  updateSettingsGroup,
  listAuditLogs,
  getAuditFilters,
  getAuditLogById,
};
