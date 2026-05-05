import { useSelector } from 'react-redux';
import permissionUtils from '../../lib/permissionUtils';
import UnifiedDashboard from './UnifiedDashboard';
import LegacyAdminDashboard from './LegacyAdminDashboard';

const DashboardHome = () => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);

  const canUseAdminDashboard = permissionUtils.hasPermission(userPermissions, 'admin_dashboard');

  if (canUseAdminDashboard) {
    return <LegacyAdminDashboard />;
  }

  return <UnifiedDashboard />;
};

export default DashboardHome;
