import permissionUtils from './permissionUtils';

const SYSTEM_ADMIN_ROLES = new Set(['system administrator', 'admin']);

const normalizeRoleName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const SYSTEM_ADMIN_ROLE_KEYS = new Set([
  'admin',
  'administrator',
  'system_admin',
  'system_administrator',
  'super_admin',
  'superadministrator',
  'super_administrator',
]);

const SYSTEM_ADMIN_FALLBACK_PERMISSIONS = [
  'admin_dashboard',
  permissionUtils.permissionKey('manage', 'Users'),
  permissionUtils.permissionKey('manage', 'Roles'),
  permissionUtils.permissionKey('manage', 'Permissions'),
  permissionUtils.permissionKey('view', 'Assigned KPI'),
  permissionUtils.permissionKey('view', 'KPI Approvals'),
  permissionUtils.permissionKey('create', 'KPI Approvals'),
  permissionUtils.permissionKey('view', 'KPI Allocation'),
  permissionUtils.permissionKey('view', 'KPI Reporting'),
  permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
  permissionUtils.permissionKey('view', 'Other Role Reports'),
  permissionUtils.permissionKey('view', 'User Management'),
  permissionUtils.permissionKey('create', 'User Management'),
  permissionUtils.permissionKey('edit', 'User Management'),
  permissionUtils.permissionKey('delete', 'User Management'),
  permissionUtils.permissionKey('view', 'Role Management'),
  permissionUtils.permissionKey('create', 'Role Management'),
  permissionUtils.permissionKey('edit', 'Role Management'),
  permissionUtils.permissionKey('delete', 'Role Management'),
  permissionUtils.permissionKey('view', 'Configuration'),
  permissionUtils.permissionKey('view', 'Alerts & Notifications'),
  permissionUtils.permissionKey('view', 'Personal Profile'),
].filter(Boolean);

const sanitizeNamePart = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '-' || normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') {
    return '';
  }

  return normalized;
};

export const normalizeAuthUser = (user, role) => {
  if (!user) return null;

  const roleName = role?.RoleName || role?.roleName || user.roleName || user.RoleName || user.role || 'User';
  const firstName = sanitizeNamePart(user.FirstName || user.firstName);
  const fatherName = sanitizeNamePart(user.FatherName || user.fatherName);
  const grandFatherName = sanitizeNamePart(user.GrandFatherName || user.grandFatherName);
  const fullName = user.FullName || user.fullName || [firstName, fatherName, grandFatherName].filter(Boolean).join(' ') || 'User';

  const rawPermissions = Array.isArray(role?.Permissions)
    ? role.Permissions
    : Array.isArray(user.permissions)
      ? user.permissions
      : Array.isArray(user.Permissions)
        ? user.Permissions
        : [];

  const flattenedPermissions = permissionUtils.flattenPermissions(rawPermissions);
  const normalizedRoleName = String(roleName || '')
    .trim()
    .toLowerCase();
  const isSystemAdmin = SYSTEM_ADMIN_ROLES.has(normalizedRoleName) || SYSTEM_ADMIN_ROLE_KEYS.has(normalizeRoleName(roleName));
  const hasChildRoles = Array.isArray(role?.ChildRoles) && role.ChildRoles.length > 0;
  const autoApproveKpis = Boolean(role?.IsDistributable ?? role?.isDistributable ?? true) || hasChildRoles;
  const approvalDefaults = autoApproveKpis
    ? [permissionUtils.permissionKey('view', 'KPI Approvals'), permissionUtils.permissionKey('create', 'KPI Approvals')]
    : [];
  const permissionKeys = isSystemAdmin
    ? [...new Set([...flattenedPermissions, ...SYSTEM_ADMIN_FALLBACK_PERMISSIONS, ...approvalDefaults])]
    : [...new Set([...flattenedPermissions, ...approvalDefaults])];
  const hasExtraMeasures = Boolean(role?.HasExtraMeasures ?? role?.hasExtraMeasures);
  const parentHasExtraMeasures = Boolean(role?.ParentRole?.HasExtraMeasures ?? role?.ParentRole?.hasExtraMeasures);

  return {
    ...user,
    id: user.id || user.Id,
    roleId: role?.Id || role?.id || user.roleId || user.RoleId || null,
    roleCategoryId: role?.RoleCategoryId || role?.roleCategoryId || user.roleCategoryId || user.RoleCategoryId || null,
    roleCategoryName: role?.RoleCategory?.CategoryName || role?.RoleCategory?.categoryName || user.roleCategoryName || user.RoleCategoryName || '',
    name: fullName,
    fullName,
    role: roleName,
    roleName,
    hasExtraMeasures,
    isDistributable: Boolean(role?.IsDistributable ?? role?.isDistributable ?? true),
    hasChildRoles,
    parentRoleId: role?.ParentRoleId || role?.parentRoleId || user.parentRoleId || user.ParentRoleId || null,
    parentHasExtraMeasures,
    permissions: permissionKeys,
    permissionKeys,
    permissionMatrix: rawPermissions,
  };
};
