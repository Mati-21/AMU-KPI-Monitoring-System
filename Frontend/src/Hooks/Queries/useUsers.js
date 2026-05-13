import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching all users
 */
export const useUsersQuery = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: async () => {
      const response = await api.get('/users', { params });
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for fetching a single user by ID
 */
export const useUserQuery = (userId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async () => {
      if (!userId) return null;
      const response = await api.get(`/users/${userId}`);
      return response.data?.data;
    },
    enabled: !!userId,
    ...options,
  });
};

/**
 * Hook for fetching user roles
 */
export const useUserRolesQuery = (params = {}) => {
  return useQuery({
    queryKey: ['user-roles', params],
    queryFn: async () => {
      const response = await api.get('/user-roles', { params });
      return response.data?.data || [];
    },
  });
};


/**
 * Hook for updating a user
 */
export const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, data }) => {
      const response = await api.put(`/users/${userId}`, data);
      return response.data?.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate both the list and the specific user detail
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.setQueryData(queryKeys.users.detail(variables.userId), data);
    },
  });
};

/**
 * Hook for updating user profile picture
 */
export const useUpdateProfilePictureMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, formData }) => {
      const response = await api.post(`/users/${userId}/profile`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};

/**
 * Hook for deleting a user
 */
export const useDeleteUserMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};

/**
 * Hook for registering a new user
 */
export const useRegisterUserMutation = () => {
  return useMutation({
    mutationFn: async (userData) => {
      const response = await api.post('/auth/register', userData);
      return response.data?.user;
    },
  });
};

/**
 * Hook for assigning a role to a user
 */
export const useAssignUserRoleMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ UserId, RoleId }) => {
      await api.post('/user-roles', { UserId, RoleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};

