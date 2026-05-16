// services/api.js
import axios from 'axios';
import { store } from '../app/store';
import { queryClient } from '../app/queryClient';
import { logout } from '../Features/authSlice';

export const BASE_URL = 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  timeout: 60000, // 60 seconds default timeout
});

api.interceptors.request.use((config) => {
  // Cookie-based auth is the primary and only mechanism.
  // withCredentials: true ensures cookies are sent automatically.

  // Increase timeout for file uploads (FormData)
  if (config.data instanceof FormData) {
    config.timeout = 120000; // 120 seconds for evidence/file uploads
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || '').toLowerCase();
    const requestUrl = String(error?.config?.url || '').toLowerCase();

    // Only auto-logout on real authentication/session failures.
    // Avoid auto-logout on the login page itself (401 for wrong password).
    const isLoginPage = window.location.pathname === '/signin';

    if (status === 401 && !isLoginPage) {
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
