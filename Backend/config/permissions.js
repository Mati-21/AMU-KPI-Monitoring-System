/**
 * Canonical atomic permission catalog (MODULES_SPECIFICATION.html).
 * scripts/seedAdmin.js syncs this list into the `permission` table; route guards reference these codes.
 */
export const SUPER_ADMIN_PERMISSION = '*';

export const PERMISSIONS = Object.freeze({
  // 01 Identity
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  // 02 Offices
  OFFICE_CREATE: 'office:create',
  OFFICE_UPDATE: 'office:update',
  OFFICE_MANAGE: 'office:manage',
  OFFICE_ASSIGN: 'office:assign',
  // 03 Roles
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  // 04 KPI catalog
  KPI_CREATE: 'kpi:create',
  KPI_UPDATE: 'kpi:update',
  KPI_MANAGE: 'kpi:manage',
  // 05 Targets
  TARGET_READ: 'target:read',
  TARGET_CREATE: 'target:create',
  TARGET_UPDATE: 'target:update',
  TARGET_ASSIGN: 'target:assign',
  TARGET_CASCADE: 'target:cascade',
  // 06 Cycles & reports
  CYCLE_MANAGE: 'cycle:manage',
  REPORT_CREATE: 'report:create',
  REPORT_READ: 'report:read',
  REPORT_SUBMIT: 'report:submit',
  REPORT_REVIEW: 'report:review',
  // 07 Evaluations
  EVALUATION_READ: 'evaluation:read',
  EVALUATION_WRITE: 'evaluation:write',
  EVALUATION_VERIFY: 'evaluation:verify',
  SCORECARD_READ: 'scorecard:read',
  DASHBOARD_READ: 'dashboard:read',
  // 08 Files & evidence
  FILE_UPLOAD: 'file:upload',
  FILE_READ: 'file:read',
  DOCUMENT_CREATE: 'document:create',
  EVIDENCE_LINK: 'evidence:link',
  EVIDENCE_READ: 'evidence:read',
  // 09 Notifications
  NOTIFICATION_SEND: 'notification:send',
  // 10 Governance
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_READ: 'audit:read',
});

export const PERMISSION_CODES = Object.freeze([SUPER_ADMIN_PERMISSION, ...Object.values(PERMISSIONS)]);

export default { SUPER_ADMIN_PERMISSION, PERMISSIONS, PERMISSION_CODES };
