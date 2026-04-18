import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ClipboardList, FileText, GraduationCap, LayoutDashboard, Settings2, Target, User, Users } from 'lucide-react';

const unifiedNavigation = [
  {
    label: 'OVERVIEW',
    items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '.' }],
  },
  {
    label: 'WORKSPACE',
    items: [
      { icon: Target, label: 'Performance', path: 'assigned-kpis', moduleName: 'Performance', action: 'view' },
      { icon: ClipboardList, label: 'Assigned KPI', path: 'assign-kpi', moduleName: 'Assigned KPI', action: 'view' },
      { icon: Users, label: 'Sub Unit', path: 'sub-unit', moduleName: 'Sub Unit', action: 'view' },
      { icon: Settings2, label: 'Registered KPIs', path: 'registered-kpis', moduleName: 'Registered KPIs', action: 'view' },
      { icon: FileText, label: 'Reports', path: 'reports', moduleName: 'KPI Reporting', action: 'view' },
      { icon: Target, label: 'KPI Management', path: 'kpi', moduleName: 'KPI Management', action: 'create' },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [{ icon: User, label: 'Profile', path: 'profile', moduleName: 'Personal Profile', action: 'view' }],
  },
];

const Sidebar = () => {
  const location = useLocation();
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);

  const hasModulePermission = (moduleName, action = 'view') => {
    if (!moduleName) return true;
    if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;

    const permissionEntry = userPermissions.find(
      (permission) =>
        String(permission?.module || '')
          .trim()
          .toLowerCase() === String(moduleName).trim().toLowerCase()
    );

    if (!permissionEntry) return false;
    return Boolean(permissionEntry[action]);
  };

  const navSections = unifiedNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const moduleName = item.moduleName;
        const action = item.action || 'view';
        return hasModulePermission(moduleName, action);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="font-bold text-foreground text-sm">ArbaMinch University</h2>
            <p className="text-xs text-muted-foreground font-medium">AMU KPI SYSTEM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{section.label}</p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;

                const isDashboard = item.label === 'Dashboard';

                return (
                  <NavLink
                    key={item.label}
                    to={item.path} // relative path
                    end={isDashboard} // only dashboard uses exact match
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
    </div>
  );
};

export default Sidebar;
