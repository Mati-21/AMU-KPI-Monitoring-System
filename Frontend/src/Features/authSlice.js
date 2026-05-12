import { createSlice } from '@reduxjs/toolkit';

const hasValidToken = (token) => typeof token === 'string' && token.trim().length > 0;

const sanitizeAuthState = (rawAuth) => {
  if (!rawAuth || typeof rawAuth !== 'object') {
    return null;
  }

  const token = hasValidToken(rawAuth.token) ? rawAuth.token : null;

  return {
    user: token ? rawAuth.user || null : null,
    token,
    status: rawAuth.status || 'idle',
    error: null,
    isAuthenticated: Boolean(token),
    isMaintenance: rawAuth.isMaintenance || false,
    systemSettings: rawAuth.systemSettings || {
      displayName: 'AMU KPI Monitoring System',
      orgName: 'ArbaMinch University',
      systemLogo: null
    },
  };
};

const getAuthFromStorage = () => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem('auth');
    if (!stored) {
      return null;
    }

    const sanitized = sanitizeAuthState(JSON.parse(stored));

    if (!sanitized?.token) {
      localStorage.removeItem('auth');
    }

    return sanitized;
  } catch {
    return null;
  }
};

const persistedAuth = getAuthFromStorage();

const initialState = persistedAuth || {
  user: null,
  token: null,
  status: 'idle',
  error: null,
  isAuthenticated: false,
  isMaintenance: false,
  systemSettings: {
    displayName: 'AMU KPI Monitoring System',
    orgName: 'ArbaMinch University',
    systemLogo: null
  },
};

const persistAuth = (state) => {
  if (typeof window === 'undefined') return;

  const token = hasValidToken(state.token) ? state.token : null;

  // Only persist minimal user info; token is stored in cookie now
  localStorage.setItem(
    'auth',
    JSON.stringify({
      user: token ? state.user : null,
      token: token, // keep token optional for backward compatibility
      status: state.status,
      error: state.error,
      isAuthenticated: Boolean(token),
      isMaintenance: state.isMaintenance,
      systemSettings: state.systemSettings,
    })
  );
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading(state) {
      state.status = 'loading';
      state.error = null;
      persistAuth(state);
    },
    setCredentials(state, action) {
      const { user, token, useCookie } = action.payload;
      const sanitizedToken = hasValidToken(token) ? token : null;

      if (useCookie) {
        // Server-set HTTP-only cookie used for auth; keep user in state
        state.user = user || null;
        state.token = null;
        state.status = 'succeeded';
        state.error = null;
        state.isAuthenticated = true;
        persistAuth(state);
        return;
      }

      state.user = sanitizedToken ? user : null;
      state.token = sanitizedToken;
      state.status = 'succeeded';
      state.error = null;
      state.isAuthenticated = Boolean(sanitizedToken);
      persistAuth(state);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
        // Also clear cookie by calling backend signout endpoint if available
      }
    },
    setUser(state, action) {
      // Cookie-auth mode does not store a token in Redux.
      // If /auth/me succeeded, we consider the user authenticated.
      state.user = action.payload || null;
      state.isAuthenticated = Boolean(action.payload);
      persistAuth(state);
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.status = 'failed';
      state.isAuthenticated = hasValidToken(state.token);
      persistAuth(state);
    },
    setMaintenance(state, action) {
      state.isMaintenance = action.payload;
      persistAuth(state);
    },
    setSystemSettings(state, action) {
      state.systemSettings = {
        ...state.systemSettings,
        ...action.payload
      };
      persistAuth(state);
    },
  },
});

export const { setAuthLoading, setCredentials, logout, setUser, setAuthError, setMaintenance, setSystemSettings } = authSlice.actions;

export default authSlice.reducer;
