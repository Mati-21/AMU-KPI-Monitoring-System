import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/01-identity/store/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
