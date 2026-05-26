import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getDefaultRouteByRole } from '../../lib/authRouting';
import permissionUtils from '../../lib/permissionUtils';

export const RequireModulePermission = ({ moduleName, action = 'view' }) => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const user = useSelector((state) => state.auth.user);
  const isSystemAdmin = permissionUtils.isSystemAdminRoleName(user?.roleName || user?.role);

  if (!moduleName) {
    return <Outlet />;
  }

  if (isSystemAdmin) {
    return <Outlet />;
  }

  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  const requiredPermission = permissionUtils.permissionKey(action, moduleName);

  if (!permissionUtils.hasPermission(userPermissions, requiredPermission)) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  return <Outlet />;
};
