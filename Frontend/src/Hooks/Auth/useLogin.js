import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDispatch } from 'react-redux';

import { api } from '../../api/axios';
import { setCredentials } from '../../Features/authSlice';
import { normalizeAuthUser } from '../../lib/authUser';
import { useNotification } from '../../Context/NotificationContext';

export const useLogin = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { notify } = useNotification();

  return useMutation({
    mutationFn: async (credentials) => {
      const { UserName, password } = credentials;
      const { data } = await api.post('/auth/login', { UserName, password });
      // Server will set HTTP-only cookie; token may not be returned in payload
      return data;
    },

    onSuccess: (data) => {
      // Server sets HTTP-only cookie. Use cookie-based auth flag.
      const normalizedUser = normalizeAuthUser(data.user, data.role);
      dispatch(setCredentials({ user: normalizedUser, useCookie: true }));

      // Save user in React Query cache
      queryClient.setQueryData(['user'], normalizedUser);
      notify('Logged in successfully.', 'success');
    },
  });
};
