import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

export const RequireAuth = () => {
  const location = useLocation();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isMaintenance = useSelector((state) => state.auth.isMaintenance);
  const user = useSelector((state) => state.auth.user);
  // Only university-wide settings managers keep working during maintenance. The backend enforces this too.
  const canWorkDuringMaintenance = (user?.permissions ?? []).some((code) => code === '*' || code === 'settings:manage');

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  if (isMaintenance && !canWorkDuringMaintenance) {
    return <Navigate to="/maintenance" replace />;
  }

  return <Outlet />;
};
