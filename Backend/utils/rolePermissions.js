/**
 * Role & Permission Helper Utilities
 */
export const permissionKey = (action, resource) => {
  const normAction = String(action || '').trim().toLowerCase();
  const normResource = String(resource || '').trim().toLowerCase();
  if (!normAction || !normResource) return '';
  return `${normAction}_${normResource}`;
};

export const isAdminRoleName = (roleName) => {
  const name = String(roleName || '').trim().toLowerCase();
  return name === 'admin' || name === 'system administrator' || name === 'super admin';
};

export default {
  permissionKey,
  isAdminRoleName,
};
