import { prisma  } from '../config/database.js';

/**
 * Logs a user or system activity to the database.
 * @param {Object} options - The log details.
 * @param {string} options.userId - The ID of the user performing the action.
 * @param {string} options.action - The type of action (e.g., 'LOGIN', 'CREATE_USER').
 * @param {string} options.resource - The resource affected (e.g., 'User', 'KPI').
 * @param {string} options.description - Human-readable description of the action.
 * @param {string} options.status - 'Success' or 'Failure'.
 * @param {string} options.ipAddress - The IP address of the request.
 */
const logActivity = async ({ userId, action, resource, description, status = 'Success', ipAddress }) => {
  try {
    await prisma.auditLogs.create({ data: {
      UserId: userId,
      Action: action,
      Resource: resource,
      Description: description,
      Status: status,
      IpAddress: ipAddress
    } });
    console.log(`[AUDIT] ${action}: ${description}`);
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to create log:', error);
  }
};

export {  logActivity  };
