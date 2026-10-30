import { prisma } from '../config/database.js';

// Field names whose values must never be written to the audit trail
const SENSITIVE_KEY = /password|secret|token|hash/i;

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item)]));
  }
  return value;
};

/**
 * Convert values to plain JSON (Dates -> ISO strings, Decimals -> strings) with secrets redacted.
 * Returns undefined for empty values: Prisma rejects a bare `null` on nullable Json fields.
 */
const toJson = (value) => (value === undefined || value === null ? undefined : redact(JSON.parse(JSON.stringify(value))));

/**
 * Logs an activity to the audit trail. Never throws: auditing must not break the business operation.
 * Schema model: AuditLog (actorPersonId, action, entityType, entityId, oldValues, newValues, reason, ipAddress, userAgent)
 */
export const logActivity = async ({ actorPersonId, action, entityType, entityId, oldValues, newValues, reason, ipAddress, userAgent }) => {
  try {
    return await prisma.auditLog.create({
      data: {
        actorPersonId: actorPersonId || null,
        action: action || 'ACTION',
        entityType: entityType || 'System',
        entityId: entityId ? String(entityId) : null,
        oldValues: toJson(oldValues),
        newValues: toJson(newValues),
        reason: reason || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.warn('[AuditLogger] Notice:', error.message);
    return null;
  }
};

/**
 * Shortcut for services: audit an action performed by the acting user (see utils/requestContext.js).
 */
export const auditAction = (actor, { action, entityType, entityId, oldValues, newValues, reason }) =>
  logActivity({
    actorPersonId: actor?.personId,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    reason,
    ipAddress: actor?.ipAddress,
    userAgent: actor?.userAgent,
  });

export default { logActivity, auditAction };
