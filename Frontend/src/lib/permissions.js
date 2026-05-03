const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

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
    ['view', 'create', 'edit', 'delete', 'approve', 'manage'].forEach((action) => {
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

  const availablePermissions = new Set(flattenPermissions(permissions));
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return requiredPermissions.some((permission) => {
    const normalized = normalizeToken(permission);
    return normalized ? availablePermissions.has(normalized) : false;
  });
};

export const normalizePermissionDisplay = (value) => normalizeToken(value).replace(/_/g, ' ');
