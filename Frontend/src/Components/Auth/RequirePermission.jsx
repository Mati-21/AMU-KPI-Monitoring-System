import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getDefaultRouteByRole } from '../../lib/authRouting';
import permissionUtils from '../../lib/permissionUtils';

export const RequirePermission = ({ permission, permissions = [], allowExtraMeasureHierarchy = false, requireExtraMeasures = false, children }) => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const user = useSelector((state) => state.auth.user);
  const isSystemAdmin = permissionUtils.isSystemAdminRoleName(user?.roleName || user?.role);
  const requiredPermissions = [permission, ...permissions].filter(Boolean);
  const hasExtraMeasureHierarchyAccess = Boolean(user?.hasExtraMeasures || user?.parentHasExtraMeasures);
  const hasExtraMeasureRoleAccess = Boolean(user?.hasExtraMeasures);

  if (requireExtraMeasures && !hasExtraMeasureRoleAccess) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  if (requiredPermissions.length === 0) {
    return children || <Outlet />;
  }

  if (isSystemAdmin) {
    return children || <Outlet />;
  }

  if (allowExtraMeasureHierarchy && hasExtraMeasureHierarchyAccess) {
    return children || <Outlet />;
  }

  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  if (permissionUtils.hasPermission(userPermissions, requiredPermissions)) {
    return children || <Outlet />;
  }

  return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
};
