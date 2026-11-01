import {
  BadgeCheck,
  Bell,
  Building2,
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
  MessageSquare,
} from 'lucide-react';
import permissionUtils from '../../features/03-access-control/lib/permissionUtils';

export const navigationSections = [
  {
    label: 'Overview',
    items: [
      {
        icon: LayoutDashboard,
        label: 'Dashboard',
        path: '/dashboard',
        permissions: [],
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
        icon: Building2,
        label: 'Offices',
        path: '/offices',
        permissions: [],
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
        permissions: ['user:read', 'user:create'],
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
        permissions: [permissionUtils.permissionKey('view', 'System Logs')],
      },
      {
        icon: MessageSquare,
        label: 'Support Requests',
        path: '/support-requests',
        permissions: ['support:manage'],
      },
      {
        icon: MessageSquare,
        label: 'Direct Messages',
        path: '/direct-messages',
        permissions: [permissionUtils.permissionKey('view', 'Direct Messages')],
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
        permissions: [],
      },
    ],
  },
];
