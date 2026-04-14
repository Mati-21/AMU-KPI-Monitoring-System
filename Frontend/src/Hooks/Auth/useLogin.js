import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDispatch } from 'react-redux';

import { api } from '../../api/axios';
import { setCredentials } from '../../Features/authSlice';
import { normalizeAuthUser } from '../../lib/authUser';

export const useLogin = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials) => {
      const { UserName, password } = credentials;
      const { data } = await api.post('/auth/login', { UserName, password });
      return data;
    },

    onSuccess: (data) => {
      const normalizedUser = normalizeAuthUser(data.user, data.role);
      dispatch(setCredentials({ user: normalizedUser, token: data.token }));

      // Save user in React Query cache
      queryClient.setQueryData(['user'], normalizedUser);
    },
  });
};
