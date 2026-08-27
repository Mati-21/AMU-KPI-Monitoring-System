const permissionKey = (action, resource) => {
  const normalizedAction = String(action || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const normalizedResource = String(resource || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalizedAction || !normalizedResource) {
    return '';
  }

  return `${normalizedAction}_${normalizedResource}`;
};

const isAdminRoleName = (roleName) => {
  const normalizedRoleName = String(roleName || '')
    .trim()
    .toLowerCase();
  return normalizedRoleName === 'admin' || normalizedRoleName === 'system administrator';
};

const normalizePermissionEntry = (permission) => {
  if (!permission || typeof permission !== 'object') {
    return null;
  }

  const moduleName = permission.module || permission.resource || permission.name || permission.label;

  return {
    module: moduleName,
    view: Boolean(permission.view),
    create: Boolean(permission.create),
    assign: Boolean(permission.assign),
    edit: Boolean(permission.edit),
    delete: Boolean(permission.delete),
    approve: Boolean(permission.approve),
  };
};

const normalizeRolePermissions = (roleName, permissions) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  void roleName;

  return permissions.map(normalizePermissionEntry).filter(Boolean);
};

export { 
  permissionKey,
  isAdminRoleName,
  normalizeRolePermissions,
 };
