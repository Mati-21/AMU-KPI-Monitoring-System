import {
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSignature,
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
        path: '/performance',
        permissions: ['report:read'],
      },
      {
        icon: FileSignature,
        label: 'My Contract',
        path: '/my-contract',
        permissions: [],
      },
      {
        icon: BadgeCheck,
        label: 'Approve KPI',
        path: '/approvals',
        permissions: ['report:review'],
      },
      {
        icon: ClipboardList,
        label: 'KPI Assignment',
        path: '/assign-kpi',
        permissions: ['contract:read'],
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
        permissions: ['report:read'],
      },
      {
        icon: Target,
        label: 'KPI Management',
        path: '/kpi',
        permissions: ['kpi:create', 'kpi:update', 'kpi:manage'],
      },
      {
        icon: CalendarDays,
        label: 'Fiscal Years',
        path: '/planning',
        permissions: ['kpi:manage', 'period:manage'],
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
        permissions: ['role:read'],
      },
      {
        icon: Lock,
        label: 'Permissions',
        path: '/permission',
        permissions: ['role:read'],
      },
      {
        icon: Settings,
        label: 'Configuration',
        path: '/configuration',
        permissions: ['settings:manage'],
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
        permissions: ['audit:read'],
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
