import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useDispatch } from 'react-redux';
import { setToken } from '../store/authSlice';

export const useAddRoleCategory = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials) => {
      console.log(credentials);
      const { data } = await api.post('/add-role-category', credentials);
      return data;
    },

    onSuccess: (data) => {
      // Save token in Redux
      dispatch(setToken(data));

      // Save user in React Query cache
      queryClient.setQueryData(['user'], data.user);
    },
  });
};