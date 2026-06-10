import { useSelector } from 'react-redux';
import { useDashboardPermission } from '../../Hooks/useDashboardPermission';
import permissionUtils from '../../lib/permissionUtils';
import UnifiedDashboard from './UnifiedDashboard';
import LegacyAdminDashboard from './LegacyAdminDashboard';

const DashboardHome = () => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const { canViewDashboard } = useDashboardPermission();

  // Check if dashboard view permission is enabled
  if (!canViewDashboard) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to access the dashboard.</p>
          <p className="text-sm text-muted-foreground mt-4">Please contact your administrator to grant you dashboard access.</p>
        </div>
      </div>
    );
  }

  const canUseAdminDashboard = permissionUtils.hasPermission(userPermissions, 'admin_dashboard');

  if (canUseAdminDashboard) {
    return <LegacyAdminDashboard />;
  }

  return <UnifiedDashboard />;
};

export default DashboardHome;
