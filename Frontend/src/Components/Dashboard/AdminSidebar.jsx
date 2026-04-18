import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { GraduationCap, Target } from 'lucide-react';
import { roleNavigation } from '../../Config/roleNavigation';

const pathToPermissionModule = {
  '.': 'Personal Profile',
  kpi: 'KPI Management',
  'user-management': 'User Management',
  'role-management': 'Role Management',
  permission: 'Role Management',
  configuration: 'Configuration',
  'alert-notification': 'Alerts & Notifications',
};

const AdminSidebar = () => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);

  const hasModulePermission = (moduleName, action = 'view') => {
    if (!moduleName) return true;
    if (!Array.isArray(userPermissions) || userPermissions.length === 0) return true;

    const permissionEntry = userPermissions.find(
      (permission) =>
        String(permission?.module || '')
          .trim()
          .toLowerCase() === String(moduleName).trim().toLowerCase()
    );

    if (!permissionEntry) return false;
    return Boolean(permissionEntry[action]);
  };

  const navSections = (roleNavigation.systemAdmin || [])
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const moduleName = pathToPermissionModule[item.path];
        return hasModulePermission(moduleName, 'view');
      }),
    }))
    .filter((section) => section.items.length > 0);

  const canViewKpiManagement = hasModulePermission('KPI Management', 'create');
  const hasKpiButton = navSections.some((section) => section.items.some((item) => item.path === 'kpi'));

  if (canViewKpiManagement && !hasKpiButton) {
    navSections.push({
      label: 'KPI MANAGEMENT',
      items: [{ icon: Target, label: 'KPI', path: 'kpi' }],
    });
  }

  return (
    <div className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
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
                    to={item.path}
                    end={isDashboard}
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

export default AdminSidebar;
