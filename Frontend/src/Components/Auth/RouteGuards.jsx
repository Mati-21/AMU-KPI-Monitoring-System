import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { api } from '../../api/axios';
import { logout, setAuthLoading, setUser } from '../../Features/authSlice';
import { normalizeAuthUser } from '../../lib/authUser';
import { getDefaultRouteByRole } from '../../lib/authRouting';
import { useNotification } from '../../Context/NotificationContext';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

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
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  return <Outlet />;
};

export const RequireModulePermission = ({ moduleName, action = 'view' }) => {
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const user = useSelector((state) => state.auth.user);

  if (!moduleName) {
    return <Outlet />;
  }

  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return <Outlet />;
  }

  const permissionEntry = userPermissions.find(
    (permission) =>
      String(permission?.module || '')
        .trim()
        .toLowerCase() === String(moduleName).trim().toLowerCase()
  );

  if (!permissionEntry || !permissionEntry[action]) {
    return <Navigate to={getDefaultRouteByRole(user?.role, user?.permissions)} replace />;
  }

  return <Outlet />;
};

export const AuthBootstrap = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const token = useSelector((state) => state.auth.token);
  const [checking, setChecking] = useState(Boolean(token));
  const idleTimerRef = useRef(null);
  const hasLoggedOutRef = useRef(false);

  const clearSession = useCallback(
    ({ message, shouldNotify = false } = {}) => {
      if (hasLoggedOutRef.current) {
        return;
      }

      hasLoggedOutRef.current = true;
      dispatch(logout());
      queryClient.clear();

      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
      }

      navigate('/signin', { replace: true });

      if (shouldNotify && message) {
        notify(message, 'warning');
      }
    },
    [dispatch, navigate, notify, queryClient]
  );

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

        hasLoggedOutRef.current = false;
        dispatch(setUser(normalizeAuthUser(data.user, data.role)));
      } catch {
        if (!mounted) return;
        clearSession();
      } finally {
        if (mounted) setChecking(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [clearSession, dispatch, token]);

  useEffect(() => {
    if (!token) {
      hasLoggedOutRef.current = false;

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      return undefined;
    }

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = window.setTimeout(() => {
        clearSession({
          message: 'You were signed out after 10 minutes of inactivity.',
          shouldNotify: true,
        });
      }, IDLE_TIMEOUT_MS);
    };

    const handleActivity = () => {
      if (!hasLoggedOutRef.current) {
        resetIdleTimer();
      }
    };

    resetIdleTimer();
    IDLE_EVENTS.forEach((eventName) => window.addEventListener(eventName, handleActivity));
    window.addEventListener('focus', handleActivity);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      IDLE_EVENTS.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      window.removeEventListener('focus', handleActivity);
    };
  }, [clearSession, token]);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking session...</div>;
  }

  return children;
};
