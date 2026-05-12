import {
  BadgeCheck,
  Bell,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  ScrollText,
  Settings,
  Settings2,
  Shield,
  Target,
  User,
  Users,
} from 'lucide-react';
import permissionUtils from '../lib/permissionUtils';

export const navigationSections = [
  {
    label: 'Overview',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/dashboard',
        permissions: [
          'admin_dashboard',
          permissionUtils.permissionKey('manage', 'Users'),
          permissionUtils.permissionKey('manage', 'Roles'),
          permissionUtils.permissionKey('manage', 'Permissions'),
          permissionUtils.permissionKey('view', 'Assigned KPI'),
          permissionUtils.permissionKey('view', 'KPI Allocation'),
          permissionUtils.permissionKey('view', 'Sub Unit'),
          permissionUtils.permissionKey('view', 'Registered KPIs'),
          permissionUtils.permissionKey('view', 'KPI Reporting'),
          permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
          permissionUtils.permissionKey('view', 'Other Role Reports'),
          permissionUtils.permissionKey('view', 'KPI Management'),
          permissionUtils.permissionKey('view', 'User Management'),
          permissionUtils.permissionKey('view', 'Role Management'),
          permissionUtils.permissionKey('view', 'Configuration'),
          permissionUtils.permissionKey('view', 'Alerts & Notifications'),
          permissionUtils.permissionKey('view', 'Personal Profile'),
        ],
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        icon: Target,
        label: 'Performance',
        path: '/assigned-kpis',
        permissions: [permissionUtils.permissionKey('view', 'Assigned KPI')],
      },
      {
        icon: BadgeCheck,
        label: 'KPI Approvals',
        path: '/kpi-approvals',
        permissions: [permissionUtils.permissionKey('view', 'KPI Approvals'), permissionUtils.permissionKey('create', 'KPI Approvals')],
      },
      {
        icon: ClipboardList,
        label: 'KPI Allocation',
        path: '/assign-kpi',
        permissions: [permissionUtils.permissionKey('view', 'KPI Allocation'), permissionUtils.permissionKey('create', 'KPI Allocation')],
      },
      {
        icon: ClipboardList,
        label: 'Drived KPI Allocation',
        path: '/drived-kpi-allocation',
        permissions: [
          permissionUtils.permissionKey('view', 'Drived KPI Allocation'),
          permissionUtils.permissionKey('create', 'Drived KPI Allocation'),
          permissionUtils.permissionKey('assign', 'Drived KPI Allocation'),
        ],
      },
      {
        icon: Users,
        label: 'Sub Unit',
        path: '/sub-unit',
        permissions: [permissionUtils.permissionKey('view', 'Sub Unit')],
      },
      {
        icon: Settings2,
        label: 'Registered KPIs',
        path: '/registered-kpis',
        permissions: [permissionUtils.permissionKey('view', 'Registered KPIs')],
      },
      {
        icon: FileText,
        label: 'Report',
        path: '/report',
        permissions: [
          permissionUtils.permissionKey('view', 'KPI Reporting'),
          permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
          permissionUtils.permissionKey('view', 'Other Role Reports'),
        ],
      },
      {
        icon: Target,
        label: 'KPI Management',
        path: '/kpi',
        permissions: [
          permissionUtils.permissionKey('view', 'KPI Management'),
          permissionUtils.permissionKey('create', 'KPI Management'),
          permissionUtils.permissionKey('edit', 'KPI Management'),
        ],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        icon: Users,
        label: 'User Management',
        path: '/user-management',
        permissions: [permissionUtils.permissionKey('view', 'User Management'), permissionUtils.permissionKey('manage', 'Users')],
      },
      {
        icon: Users,
        label: 'Create User',
        path: '/user-management?tab=add',
        permissions: [permissionUtils.permissionKey('create', 'Child Office Accounts')],
      },
      {
        icon: Shield,
        label: 'Role Management',
        path: '/role-management',
        permissions: [
          permissionUtils.permissionKey('view', 'Role Management'),
          permissionUtils.permissionKey('create', 'Role Management'),
          permissionUtils.permissionKey('manage', 'Roles'),
          permissionUtils.permissionKey('manage', 'Permissions'),
        ],
      },
      {
        icon: Lock,
        label: 'Permissions',
        path: '/permission',
        permissions: [permissionUtils.permissionKey('view', 'Role Management'), permissionUtils.permissionKey('manage', 'Permissions')],
      },
      {
        icon: Settings,
        label: 'Configuration',
        path: '/configuration',
        permissions: [permissionUtils.permissionKey('view', 'Configuration')],
      },
      {
        icon: Bell,
        label: 'Alerts',
        path: '/alert-notification',
        permissions: [permissionUtils.permissionKey('view', 'Alerts & Notifications')],
      },
      {
        icon: ScrollText,
        label: 'System Logs',
        path: '/system-logs',
        permissions: [permissionUtils.permissionKey('view', 'Configuration'), permissionUtils.permissionKey('view', 'Role Management')],
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        icon: User,
        label: 'Profile',
        path: '/profile',
        permissions: [permissionUtils.permissionKey('view', 'Personal Profile')],
      },
    ],
  },
];
