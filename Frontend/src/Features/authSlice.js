import { createSlice } from '@reduxjs/toolkit';

const sanitizeAuthState = (rawAuth) => {
  if (!rawAuth || typeof rawAuth !== 'object') {
    return null;
  }

  // With cookie-based auth, we don't store a token.
  // Authenticated status is determined by having a user object.
  const user = rawAuth.user || null;

  return {
    user,
    status: rawAuth.status || 'idle',
    error: null,
    isAuthenticated: Boolean(user),
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
    return sanitized;
  } catch {
    return null;
  }
};

const persistedAuth = getAuthFromStorage();

const initialState = persistedAuth || {
  user: null,
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

  localStorage.setItem(
    'auth',
    JSON.stringify({
      user: state.user,
      status: state.status,
      error: state.error,
      isAuthenticated: state.isAuthenticated,
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
      const { user } = action.payload;
      
      state.user = user || null;
      state.status = 'succeeded';
      state.error = null;
      state.isAuthenticated = Boolean(user);
      persistAuth(state);
    },
    logout(state) {
      state.user = null;
      state.status = 'idle';
      state.error = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth');
      }
    },
    setUser(state, action) {
      state.user = action.payload || null;
      state.isAuthenticated = Boolean(action.payload);
      state.status = action.payload ? 'succeeded' : 'idle';
      persistAuth(state);
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.status = 'failed';
      state.isAuthenticated = false;
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
