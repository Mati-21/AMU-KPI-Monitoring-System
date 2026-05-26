import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getDefaultRouteByRole } from '../../lib/authRouting';

export const GuestOnly = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);

  if (isAuthenticated) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  return <Outlet />;
};
