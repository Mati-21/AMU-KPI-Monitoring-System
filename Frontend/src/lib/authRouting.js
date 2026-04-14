export const getDefaultRouteByRole = (roleInput) => {
  const role = (roleInput || '').toString().toLowerCase();

  if (role.includes('staff')) return '/staff';
  if (role.includes('chair')) return '/department-chair';
  if (role.includes('faculty') || role.includes('dean')) return '/faculty-admin';
  if (role.includes('higher')) return '/higher-institution';
  if (role.includes('vice')) return '/vice-president';
  if (role.includes('strategic')) return '/strategic-office';

  return '/admin';
};
