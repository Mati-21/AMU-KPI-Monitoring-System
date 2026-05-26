import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import permissionUtils from '../../lib/permissionUtils';

export const RequireAuth = () => {
  const location = useLocation();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isMaintenance = useSelector((state) => state.auth.isMaintenance);
  const user = useSelector((state) => state.auth.user);
  const isSystemAdmin = permissionUtils.isSystemAdminRoleName(user?.roleName || user?.role);

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  if (isMaintenance && !isSystemAdmin) {
    return <Navigate to="/maintenance" replace />;
  }

  return <Outlet />;
};
