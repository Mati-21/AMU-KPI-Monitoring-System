import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { api } from '../../api/axios';
import { logout, setAuthLoading, setUser } from '../../Features/authSlice';
import { normalizeAuthUser } from '../../lib/authUser';
import { getDefaultRouteByRole } from '../../lib/authRouting';

export const RequireAuth = () => {
  const location = useLocation();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export const GuestOnly = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const user = useSelector((state) => state.auth.user);

  if (isAuthenticated) {
    return <Navigate to={getDefaultRouteByRole(user?.role)} replace />;
  }

  return <Outlet />;
};

export const AuthBootstrap = ({ children }) => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (!token) {
        if (mounted) setChecking(false);
        return;
      }

      try {
        dispatch(setAuthLoading());
        const { data } = await api.get('/auth/me');
        if (!mounted) return;

        dispatch(setUser(normalizeAuthUser(data.user, data.role)));
      } catch {
        if (!mounted) return;
        dispatch(logout());
      } finally {
        if (mounted) setChecking(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [dispatch, token]);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking session...</div>;
  }

  return children;
};
