import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { api } from '../../../shared/api/axios';
import { normalizeAuthUser } from '../lib/authUser';
import { setUser } from '../store/authSlice';

const MY_SESSIONS_KEY = ['my-sessions'];

/**
 * Reload the signed-in user after a change, so the navbar and every page agree.
 */
export const useRefreshMe = () => {
  const dispatch = useDispatch();
  return async () => {
    const { data } = await api.get('/auth/me');
    dispatch(setUser(normalizeAuthUser(data.data)));
  };
};

export const useUpdateMyProfile = () => {
  const refreshMe = useRefreshMe();
  return useMutation({ mutationFn: (details) => api.put('/auth/me', details), onSuccess: refreshMe });
};

export const useUploadMyPicture = () => {
  const refreshMe = useRefreshMe();
  return useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('file', file);
      return api.put('/auth/me/profile-picture', form);
    },
    onSuccess: refreshMe,
  });
};

export const useRemoveMyPicture = () => {
  const refreshMe = useRefreshMe();
  return useMutation({ mutationFn: () => api.delete('/auth/me/profile-picture'), onSuccess: refreshMe });
};

export const useChangeMyPassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => api.post('/auth/change-password', values).then(({ data }) => data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_SESSIONS_KEY }),
  });
};

export const useStartMfaSetup = () => useMutation({ mutationFn: () => api.post('/auth/mfa/setup').then(({ data }) => data.data) });

export const useVerifyMfaSetup = () => {
  const refreshMe = useRefreshMe();
  return useMutation({ mutationFn: (code) => api.post('/auth/mfa/verify-setup', { code }), onSuccess: refreshMe });
};

export const useDisableMfa = () => {
  const refreshMe = useRefreshMe();
  return useMutation({ mutationFn: (code) => api.post('/auth/mfa/disable', { code }), onSuccess: refreshMe });
};

export const useMySessions = () => useQuery({ queryKey: MY_SESSIONS_KEY, queryFn: () => api.get('/auth/sessions').then(({ data }) => data.data) });

export const useRevokeMySession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_SESSIONS_KEY }),
  });
};

export const useRevokeMyOtherSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/sessions/revoke-others'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_SESSIONS_KEY }),
  });
};
