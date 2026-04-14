import { createSlice } from '@reduxjs/toolkit';

const getAuthFromStorage = () => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : null;
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

  localStorage.setItem(
    'auth',
    JSON.stringify({
      user: state.user,
      token: state.token,
      status: state.status,
      error: state.error,
      isAuthenticated: Boolean(state.user || state.token),
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
      state.user = user;
      state.token = token;
      state.status = 'succeeded';
      state.error = null;
      state.isAuthenticated = Boolean(user || token);
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
      state.user = action.payload;
      state.isAuthenticated = Boolean(state.user || state.token);
      persistAuth(state);
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.status = 'failed';
      state.isAuthenticated = Boolean(state.user || state.token);
      persistAuth(state);
    },
  },
});

export const { setAuthLoading, setCredentials, logout, setUser, setAuthError } = authSlice.actions;

export default authSlice.reducer;
