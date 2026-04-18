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
};

const persistAuth = (state) => {
  if (typeof window === 'undefined') return;

  const token = hasValidToken(state.token) ? state.token : null;

  localStorage.setItem(
    'auth',
    JSON.stringify({
      user: token ? state.user : null,
      token,
      status: state.status,
      error: state.error,
      isAuthenticated: Boolean(token),
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
      const { user, token } = action.payload;
      const sanitizedToken = hasValidToken(token) ? token : null;
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
      }
    },
    setUser(state, action) {
      if (!hasValidToken(state.token)) {
        state.user = null;
        state.isAuthenticated = false;
        persistAuth(state);
        return;
      }

      state.user = action.payload;
      state.isAuthenticated = true;
      persistAuth(state);
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.status = 'failed';
      state.isAuthenticated = hasValidToken(state.token);
      persistAuth(state);
    },
  },
});

export const { setAuthLoading, setCredentials, logout, setUser, setAuthError } = authSlice.actions;

export default authSlice.reducer;
