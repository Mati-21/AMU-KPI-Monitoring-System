import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Settings =====

/**
 * Public institutional configuration (isPublic settings + active fiscal year label).
 */
export const getPublicSettings = async () => notImplemented('getPublicSettings');

export const getSettingsGrouped = async () => notImplemented('getSettingsGrouped');

/**
 * Batch upsert key/value settings within one group.
 */
export const updateSettingsGroup = async (groupName, { settings }, actor) => notImplemented('updateSettingsGroup');

// ===== Audit trail =====

export const listAuditLogs = async ({ actorPersonId, action, entityType, from, to, page, limit } = {}) => notImplemented('listAuditLogs');

export const getAuditLogById = async (id) => notImplemented('getAuditLogById');

export default {
  getPublicSettings,
  getSettingsGrouped,
  updateSettingsGroup,
  listAuditLogs,
  getAuditLogById,
};
