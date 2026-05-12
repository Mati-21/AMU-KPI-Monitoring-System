// config/roleNavigation.js
import {
  BadgeCheck,
  LayoutDashboard,
  Target,
  Users,
  ClipboardList,
  BarChart3,
  Building2,
  FileText,
  Star,
  UserCheck,
  Eye,
  PieChart,
  Briefcase,
  Award,
  Shield,
  Lock,
  Settings,
  Settings2,
  Bell,
} from 'lucide-react';

export const roleNavigation = {
  // System Admin
  systemAdmin: [
    {
      label: 'SYSTEM OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'KPI MANAGEMENT',
      items: [{ icon: Target, label: 'KPI', path: 'kpi' }],
    },
    {
      label: 'USER & ACCESS MANAGEMENT',
      items: [
        { icon: Shield, label: 'Role Management', path: 'role-management' },
        { icon: Users, label: 'User Management', path: 'user-management' },
        { icon: Lock, label: 'Permission', path: 'permission' },
      ],
    },
    {
      label: 'SYSTEM CONFIGURATION',
      items: [
        { icon: Settings, label: 'Configuration', path: 'configuration' },
        { icon: Bell, label: 'Alert and Notification', path: 'alert-notification' },
      ],
    },
  ],

  // Staff Member
  staff: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'MY WORK',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: Target, label: 'My KPIs', path: 'my-kpis' },
        { icon: ClipboardList, label: 'Self Evaluation', path: 'self-evaluation' },
        { icon: FileText, label: 'Report', path: 'report' },
      ],
    },
  ],

  // Department Chair
  departmentChair: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'DEPARTMENT',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: BadgeCheck, label: 'KPI Approvals', path: 'kpi-approvals' },
        { icon: ClipboardList, label: 'Drived KPI Allocation', path: 'drived-kpi-allocation' },
        { icon: BarChart3, label: 'Dept. KPIs', path: 'dept-kpis' },
        { icon: Users, label: 'Staff Performance', path: 'staff-performance' },
        { icon: UserCheck, label: 'KPI Assignment', path: 'kpi-assignment' },
      ],
    },
  ],

  // Faculty / College
  facultyAdmin: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'FACULTY MANAGEMENT',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: Target, label: 'Faculty KPIs', path: 'faculty-kpis' },
        { icon: ClipboardList, label: 'Drived KPI Allocation', path: 'drived-kpi-allocation' },
        { icon: Users, label: 'Sub Unit', path: 'sub-unit' },
        { icon: FileText, label: 'Report', path: 'report' },
        { icon: Building2, label: 'Departments', path: 'departments' },
        { icon: Star, label: 'Evaluations', path: 'evaluations' },
      ],
    },
  ],

  // Higher Institution
  higherInstitution: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'INSTITUTION',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: BadgeCheck, label: 'KPI Approvals', path: 'kpi-approvals' },
        { icon: ClipboardList, label: 'Drived KPI Allocation', path: 'drived-kpi-allocation' },
        { icon: Award, label: 'Institution KPIs', path: 'institution-kpis' },
        { icon: Settings2, label: 'Registered Kpis', path: 'registered-kpis' },
        { icon: Eye, label: 'Oversight', path: 'oversight' },
        { icon: FileText, label: 'Report', path: 'report' },
      ],
    },
  ],

  // Vice President Office
  vicePresident: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'SECTOR MANAGEMENT',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: BadgeCheck, label: 'KPI Approvals', path: 'kpi-approvals' },
        { icon: ClipboardList, label: 'Drived KPI Allocation', path: 'drived-kpi-allocation' },
        { icon: Users, label: 'Sub Unit', path: 'sub-unit' },
        { icon: Settings2, label: 'Registered Kpis', path: 'registered-kpis' },
        { icon: FileText, label: 'Report', path: 'report' },
      ],
    },
  ],

  // Strategic Office
  strategicOffice: [
    {
      label: 'OVERVIEW',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
    },
    {
      label: 'STRATEGIC PLANNING',
      items: [
        { icon: Target, label: 'Performance', path: 'assigned-kpis' },
        { icon: BadgeCheck, label: 'KPI Approvals', path: 'kpi-approvals' },
        { icon: ClipboardList, label: 'Drived KPI Allocation', path: 'drived-kpi-allocation' },
        { icon: Users, label: 'Sub Unit', path: 'sub-unit' },
        { icon: FileText, label: 'Report', path: 'report' },
        { icon: Settings2, label: 'Registered Kpis', path: 'registered-kpis' },
      ],
    },
  ],
};
