import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDispatch } from 'react-redux';

import { api } from '../../../shared/api/axios';
import { setCredentials } from '../store/authSlice';
import { normalizeAuthUser } from '../lib/authUser';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { queryKeys } from '../../../shared/config/queryKeys';

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
      const normalizedUser = normalizeAuthUser(data.user, data.role);
      dispatch(setCredentials({ user: normalizedUser }));

      // Save user in React Query cache
      queryClient.setQueryData(['user'], normalizedUser);
      notify('Logged in successfully.', 'success');

      // Prefetch dashboard data to make initial navigation instant
      if (normalizedUser.permissions?.includes('admin_dashboard') || normalizedUser.roleName === 'System Administrator') {
        queryClient.prefetchQuery({
          queryKey: [...queryKeys.dashboard.admin, undefined], 
          queryFn: async () => {
            const response = await api.get('/admin-dashboard/summary');
            return response.data?.data;
          },
          staleTime: 1000 * 60 * 2,
        });
      }
    },
  });
};
