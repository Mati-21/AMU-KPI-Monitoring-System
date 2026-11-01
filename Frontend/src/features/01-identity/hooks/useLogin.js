import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { api } from '../../../shared/api/axios';
import { getDefaultRouteByRole } from '../lib/authRouting';
import { normalizeAuthUser } from '../lib/authUser';
import { setCredentials } from '../store/authSlice';
import { useNotification } from '../../09-notifications/context/NotificationContext';

const STEP_OF_STATUS = {
  REQUIRE_PASSWORD_CHANGE: 'change-password',
  REQUIRE_MFA_SETUP: 'mfa-setup',
  REQUIRE_MFA_VERIFY: 'mfa-code',
};

/**
 * The login steps. The backend says what comes next after each one, until the session opens.
 */
export const useLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const [step, setStep] = useState('password');
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);

  const handleResult = async ({ data }) => {
    const next = STEP_OF_STATUS[data.status];
    if (next) {
      setMfaSetupRequired(Boolean(data.mfaSetupRequired));
      setStep(next);
      return;
    }
    const { data: me } = await api.get('/auth/me');
    const user = normalizeAuthUser(me.data);
    queryClient.clear();
    dispatch(setCredentials({ user }));
    notify('Logged in successfully.', 'success');
    navigate(getDefaultRouteByRole(user.role, user.permissions), { replace: true });
  };

  const signIn = useMutation({ mutationFn: ({ identifier, password }) => api.post('/auth/login', { username: identifier, password }), onSuccess: handleResult });
  const changePassword = useMutation({ mutationFn: (newPassword) => api.post('/auth/change-password-first-login', { newPassword }), onSuccess: handleResult });
  const verifySetupCode = useMutation({ mutationFn: (code) => api.post('/auth/mfa/verify-setup', { code }), onSuccess: handleResult });
  const verifyCode = useMutation({ mutationFn: (code) => api.post('/auth/mfa/verify', { code }), onSuccess: handleResult });

  return {
    step,
    mfaSetupRequired,
    restart: () => setStep('password'),
    signIn,
    changePassword,
    verifySetupCode,
    verifyCode,
  };
};

export default useLogin;
