const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  'admin',
  'administrator',
  'system_admin',
  'system_administrator',
  'super_admin',
  'superadministrator',
  'super_administrator',
]);

const RESOURCE_ALIASES = {
  performance: ['assigned_kpi'],
  assigned_kpi: ['performance'],
};

const expandPermissionAliases = (permission) => {
  const normalized = normalizeToken(permission);
  if (!normalized) {
    return [];
  }

  const match = normalized.match(/^([a-z]+)_(.+)$/);
  if (!match) {
    return [normalized];
  }

  const action = match[1];
  const resource = match[2];
  const resources = [resource, ...(RESOURCE_ALIASES[resource] || [])];

  return [...new Set(resources.map((entry) => `${action}_${entry}`))];
};

export const permissionKey = (action, resource) => {
  const normalizedAction = normalizeToken(action);
  const normalizedResource = normalizeToken(resource);

  if (!normalizedAction || !normalizedResource) {
    return '';
  }

  return `${normalizedAction}_${normalizedResource}`;
};

export const flattenPermissions = (permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return [];
  }

  const flattened = new Set();

  permissions.forEach((permission) => {
    if (typeof permission === 'string') {
      const normalized = normalizeToken(permission);
      if (normalized) {
        flattened.add(normalized);
      }
      return;
    }

    if (!permission || typeof permission !== 'object') {
      return;
    }

    if (typeof permission.permission === 'string') {
      const normalized = normalizeToken(permission.permission);
      if (normalized) {
        flattened.add(normalized);
      }
    }

    const resource = permission.module || permission.resource || permission.name || permission.label;
    ['view', 'create', 'assign', 'edit', 'delete', 'approve', 'manage'].forEach((action) => {
      if (permission[action]) {
        const key = permissionKey(action, resource);
        if (key) {
          flattened.add(key);
        }
      }
    });
  });

  return [...flattened];
};

export const hasPermission = (permissions, requiredPermission) => {
  if (!requiredPermission) {
    return true;
  }

  const availablePermissions = new Set(flattenPermissions(permissions).flatMap((permission) => expandPermissionAliases(permission)));
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return requiredPermissions.some((permission) => {
    const normalized = normalizeToken(permission);
    return normalized ? availablePermissions.has(normalized) : false;
  });
};

export const normalizePermissionDisplay = (value) => normalizeToken(value).replace(/_/g, ' ');

export const isSystemAdminRoleName = (roleName) => SYSTEM_ADMIN_ROLE_NAMES.has(normalizeToken(roleName));

export default {
  permissionKey,
  flattenPermissions,
  hasPermission,
  normalizePermissionDisplay,
  isSystemAdminRoleName,
};
