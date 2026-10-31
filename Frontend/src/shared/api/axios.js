import axios from 'axios';
import { store } from '../../app/store';
import { queryClient } from '../../app/queryClient';
import { logout } from '../../features/01-identity/store/authSlice';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8058';

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  withCredentials: true,
  timeout: 60000,
});

// These answer 401 for a wrong password or code, or an expired login step. A refresh would not help.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh-token', '/auth/change-password-first-login', '/auth/mfa/verify', '/auth/mfa/verify-setup', '/auth/mfa/setup'];

let refreshing = null;

// Requests that fail together share one refresh, because a refresh token can only be used once
const refreshSession = () => {
  refreshing ??= api.post('/auth/refresh-token').finally(() => {
    refreshing = null;
  });
  return refreshing;
};

const endSession = () => {
  store.dispatch(logout());
  queryClient.clear();
};

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.timeout = 120000;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const status = response?.status;

    if (status === 401 && config && !config.retriedAfterRefresh && !NO_REFRESH_PATHS.includes(config.url)) {
      config.retriedAfterRefresh = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        endSession();
      }
    }

    if (status === 503 && response.data?.code === 'MAINTENANCE' && window.location.pathname !== '/maintenance') {
      window.location.href = '/maintenance';
    }

    return Promise.reject(error);
  }
);
