import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { GraduationCap } from 'lucide-react';
import { navigationSections } from '../../Config/navigation';
import permissionUtils from '../../lib/permissionUtils';

const Sidebar = () => {
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const isSystemAdmin = permissionUtils.isSystemAdminRoleName(authUser?.roleName || authUser?.role);
  const hiddenForAdminLabels = new Set(['Performance', 'KPI Allocation', 'Drived KPI Allocation', 'Sub Unit', 'Registered KPIs', 'Report']);

  const canAccessFullUserManagement = permissionUtils.hasPermission(userPermissions, [
    permissionUtils.permissionKey('view', 'User Management'),
    permissionUtils.permissionKey('create', 'User Management'),
    permissionUtils.permissionKey('edit', 'User Management'),
    permissionUtils.permissionKey('delete', 'User Management'),
    permissionUtils.permissionKey('manage', 'Users'),
  ]);

  const navSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const isCreateUserShortcut = item.label === 'Create User' && item.path === '/user-management?tab=add';

        if (isCreateUserShortcut && canAccessFullUserManagement) {
          return false;
        }

        if (isSystemAdmin && hiddenForAdminLabels.has(item.label)) {
          return false;
        }

        return permissionUtils.hasPermission(userPermissions, item.permissions || []);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-border bg-card">
      <div className="flex h-full flex-col">
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
    </aside>
  );
};

export default Sidebar;
