import permissionUtils from './permissionUtils';

const permissionRoutes = [
  {
    permissions: [permissionUtils.permissionKey('view', 'User Management'), permissionUtils.permissionKey('manage', 'Users')],
    route: '/user-management',
  },
  {
    permissions: [permissionUtils.permissionKey('create', 'KPI Management'), permissionUtils.permissionKey('edit', 'KPI Management')],
    route: '/kpi',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'KPI Approvals')],
    route: '/kpi-approvals',
  },
  {
    permissions: [
      permissionUtils.permissionKey('view', 'KPI Reporting'),
      permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
      permissionUtils.permissionKey('view', 'Other Role Reports'),
    ],
    route: '/report',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Assigned KPI')],
    route: '/assigned-kpis',
  },
  {
    permissions: [
      permissionUtils.permissionKey('view', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('create', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('assign', 'Drived KPI Allocation'),
    ],
    route: '/drived-kpi-allocation',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Sub Unit')],
    route: '/sub-unit',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Registered KPIs')],
    route: '/registered-kpis',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Role Management')],
    route: '/role-management',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Configuration')],
    route: '/configuration',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Personal Profile')],
    route: '/profile',
  },
  {
    permissions: [permissionUtils.permissionKey('view', 'Direct Messages')],
    route: '/direct-messages',
  },
];

export const getDefaultRouteByRole = (_roleInput, _userPermissions = []) => {
  return '/dashboard';
};
