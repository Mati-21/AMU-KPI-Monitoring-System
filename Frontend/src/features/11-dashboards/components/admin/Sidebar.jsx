import { LayoutDashboard, BarChart3, Shield, Users, Lock, Settings, Bell, GraduationCap } from 'lucide-react';

import { NavLink } from 'react-router-dom';

// ✅ Fixed paths
const navSections = [
  {
    label: 'System Overview',
    items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/admin' }],
  },
  {
    label: 'KPI Management',
    items: [{ icon: BarChart3, label: 'KPI', path: 'kpi' }],
  },
  {
    label: 'User & Access Management',
    items: [
      { icon: Shield, label: 'Role Management', path: 'role-management' },
      { icon: Users, label: 'User Management', path: 'user-management' },
      { icon: Lock, label: 'Permission', path: 'permission' }, // ✅ fixed
    ],
  },
  {
    label: 'System Configuration',
    items: [
      { icon: Settings, label: 'Configuration', path: 'configuration' },
      { icon: Bell, label: 'Alert and Notification', path: 'alert-notification' },
    ],
  },
];

const Sidebar = () => {
  return (
    <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-background)] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--sidebar-border)]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-[var(--sidebar-accent)] flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-[var(--sidebar-primary)]" />
          </div>
          <div className="text-center">
            <h2 className="font-bold text-[var(--sidebar-foreground)] text-xs uppercase leading-tight max-w-[180px]">ArbaMinch University</h2>
            <p className="text-[10px] text-[var(--sidebar-muted)] font-bold tracking-tight mt-0.5">AMU KPI SYSTEM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[11px] font-semibold text-[var(--sidebar-muted)] uppercase tracking-wider px-3 mb-2">{section.label}</p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    end={item.path === '/admin'} // ✅ only for dashboard exact match
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]' : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                      }`
                    }
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
