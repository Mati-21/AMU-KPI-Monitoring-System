import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';

import { api } from '../../api/axios';
import { logout, setAuthLoading, setUser, setMaintenance, setSystemSettings } from '../../Features/authSlice';
import { normalizeAuthUser } from '../../lib/authUser';
import { useNotification } from '../../Context/NotificationContext';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export const AuthBootstrap = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const systemSettings = useSelector((state) => state.auth.systemSettings);
  const [checking, setChecking] = useState(true);
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

      // Attempt to clear server cookie
      try {
        api.post('/auth/logout').catch(() => {});
      } catch {}

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
      try {
        // Optimistic loading: If we already have a user in Redux from localStorage,
        // we can stop showing the 'checking' screen immediately and verify in background.
        if (isAuthenticated) {
          setChecking(false);
        } else {
          dispatch(setAuthLoading());
        }
        
        // Parallel fetch for session and comprehensive system status
        const [authRes, systemRes] = await Promise.allSettled([
          api.get('/auth/me'),
          api.get('/settings/status')
        ]);

        if (!mounted) return;

        // 1. Sync branding and maintenance state
        if (systemRes.status === 'fulfilled') {
          const { maintenanceMode, displayName, orgName, systemLogo, system_logo } = systemRes.value.data;
          dispatch(setMaintenance(maintenanceMode));
          dispatch(setSystemSettings({ 
            displayName, 
            orgName, 
            systemLogo: systemLogo || system_logo 
          }));
        }

        // 2. Handle Auth Session
        if (authRes.status === 'fulfilled') {
          hasLoggedOutRef.current = false;
          dispatch(setUser(normalizeAuthUser(authRes.value.data.user, authRes.value.data.role)));
        } else {
          // session check failed (401)
          dispatch(logout());
          queryClient.clear();
        }
      } catch (err) {
        if (!mounted) return;
        dispatch(logout());
        queryClient.clear();
      } finally {
        if (mounted) setChecking(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, [dispatch, queryClient]);

  useEffect(() => {
    if (!isAuthenticated) {
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
          message: 'You were signed out after 1 hour of inactivity.',
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
  }, [clearSession, isAuthenticated]);

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="relative">
          {/* Outer Ring */}
          <div className="h-16 w-16 animate-spin rounded-full border-2 border-primary/20 border-t-primary"></div>
          
          {/* Inner Pulsing Logo/Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded-full bg-primary/10"></div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-col items-center gap-2">
          <h2 className="text-sm font-bold tracking-widest text-foreground uppercase">
            {systemSettings?.orgName || 'AMU'}
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest animate-pulse">
            Verifying Secure Session...
          </p>
        </div>

        {/* Subtle background glow */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-[25%] -left-[25%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
          <div className="absolute -bottom-[25%] -right-[25%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        </div>
      </div>
    );
  }

  return children;
};
