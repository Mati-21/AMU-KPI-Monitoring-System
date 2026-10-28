import { prisma } from '../config/database.js';

/**
 * Logs an activity to the audit trail
 * Schema model: AuditLog (actorPersonId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent)
 */
export const logActivity = async ({ actorPersonId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent }) => {
  try {
    const log = await prisma.auditLog.create({
      data: {
        actorPersonId: actorPersonId || null,
        action: action || 'ACTION',
        entityType: entityType || 'System',
        entityId: entityId ? String(entityId) : null,
        oldValues: oldValues || null,
        newValues: newValues || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
    return log;
  } catch (error) {
    console.warn('[AuditLogger] Notice:', error.message);
    return null;
  }
};

export default { logActivity };
