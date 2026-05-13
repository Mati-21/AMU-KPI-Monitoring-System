import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching all roles
 */
export const useRolesQuery = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: async () => {
      const response = await api.get('/roles', { params });
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for fetching all role categories
 */
export const useRoleCategoriesQuery = () => {
  return useQuery({
    queryKey: queryKeys.roles.categories,
    queryFn: async () => {
      const response = await api.get('/role-categories');
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for updating a role
 */
export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      await api.put(`/roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
  });
};

/**
 * Hook for deleting a role
 */
export const useDeleteRoleMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
  });
};

/**
 * Hook for updating a role category
 */
export const useUpdateRoleCategoryMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      await api.put(`/role-categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.categories });
    },
  });
};

/**
 * Hook for deleting a role category
 */
export const useDeleteRoleCategoryMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/role-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.categories });
    },
  });
};

/**
 * Hook for creating a role
 */
export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      await api.post('/roles', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
  });
};

/**
 * Hook for creating a role category
 */
export const useCreateRoleCategoryMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      await api.post('/role-categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.categories });
    },
  });
};



