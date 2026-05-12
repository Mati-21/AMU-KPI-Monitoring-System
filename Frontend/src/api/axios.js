// services/api.js
import axios from 'axios';
import { store } from '../app/store';
import { queryClient } from '../app/queryClient';
import { logout } from '../Features/authSlice';

export const BASE_URL = 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Cookie-based auth is the primary mechanism.
  // Avoid auto-sending stale Bearer tokens from local state,
  // which can override the correct httpOnly cookie session.

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || '').toLowerCase();
    const requestUrl = String(error?.config?.url || '').toLowerCase();

    const isAuthFailureMessage =
      message.includes('not authorized, token failed') ||
      message.includes('not authorized, no token') ||
      message.includes('jwt') ||
      message.includes('token expired');

    const isAuthEndpoint = requestUrl.includes('/auth/me');

    // Only auto-logout on real authentication/session failures.
    // Some endpoints may legitimately return 401 for other reasons; avoid kicking users out unnecessarily.
    if (status === 401 && (isAuthFailureMessage || isAuthEndpoint)) {
      store.dispatch(logout());
      queryClient.clear();
    }

    const isStatusCheck = requestUrl.includes('/settings/status');
    const isMaintenancePage = window.location.pathname === '/maintenance';

    if (status === 503 && error?.response?.data?.maintenance && !isStatusCheck && !isMaintenancePage) {
      window.location.href = '/maintenance';
    }

    return Promise.reject(error);
  }
);
