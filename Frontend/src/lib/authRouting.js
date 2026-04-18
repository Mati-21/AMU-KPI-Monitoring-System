const hasPermission = (permissions, moduleName, action = 'view') => {
  if (!Array.isArray(permissions) || permissions.length === 0) return false;

  const entry = permissions.find(
    (permission) =>
      String(permission?.module || '')
        .trim()
        .toLowerCase() === String(moduleName).trim().toLowerCase()
  );

  return Boolean(entry?.[action]);
};

export const getDefaultRouteByRole = (roleInput, permissions = []) => {
  const role = (roleInput || '').toString().toLowerCase();

  if (role.includes('admin')) return '/admin';
  if (role.includes('staff')) return '/staff';
  if (role.includes('chair')) return '/department-chair';
  if (role.includes('faculty') || role.includes('dean')) return '/faculty-admin';
  if (role.includes('higher')) return '/higher-institution';
  if (role.includes('vice')) return '/vice-president';
  if (role.includes('strategic')) return '/strategic-office';

  if (hasPermission(permissions, 'Sub Unit', 'view')) {
    return '/faculty-admin';
  }

  if (
    hasPermission(permissions, 'Performance', 'view') ||
    hasPermission(permissions, 'Assigned KPI', 'view') ||
    hasPermission(permissions, 'Registered KPIs', 'view') ||
    hasPermission(permissions, 'KPI Allocation', 'view')
  ) {
    return '/higher-institution';
  }

  return '/staff';
};
