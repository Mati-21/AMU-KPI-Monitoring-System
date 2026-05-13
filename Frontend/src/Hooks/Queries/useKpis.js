import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching all KPIs
 */
export const useKpisQuery = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.kpis.list(params),
    queryFn: async () => {
      const response = await api.get('/kpis', { params });
      return response.data?.data || [];
    },
    staleTime: 1000 * 60, // 1 minute
  });
};

/**
 * Hook for fetching KPI types
 */
export const useKpiTypesQuery = () => {
  return useQuery({
    queryKey: queryKeys.kpis.types,
    queryFn: async () => {
      const response = await api.get('/kpi-types');
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};

/**
 * Hook for fetching user KPI assignments
 */
export const useUserKpisQuery = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.kpis.assignments(params),
    queryFn: async () => {
      const response = await api.get('/user-kpis', { params });
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for creating a user KPI assignment
 */
export const useCreateUserKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/user-kpis', data);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
    },
  });
};

/**
 * Hook for updating a user KPI assignment
 */
export const useUpdateUserKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/user-kpis/${id}`, data);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
    },
  });
};

/**
 * Hook for deleting a user KPI assignment
 */
export const useDeleteUserKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/user-kpis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
    },
  });
};

/**
 * Hook for fetching KPI approvals
 */
export const useKpiApprovalsQuery = () => {
  return useQuery({
    queryKey: queryKeys.kpis.approvals,
    queryFn: async () => {
      const response = await api.get('/user-kpi-results/approvals');
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for approving a KPI result
 */
export const useApproveKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await api.patch(`/user-kpi-results/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
    },
  });
};

/**
 * Hook for adjusting and approving a KPI result
 */
export const useAdjustKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, adjustedValue }) => {
      await api.patch(`/user-kpi-results/${id}/adjust`, { adjustedValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
    },
  });
};

/**
 * Hook for submitting KPI performance
 */
export const useSubmitPerformanceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData) => {
      await api.post('/user-kpi-results', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
    },
  });
};

/**
 * Hook for fetching office report data
 */
export const useReportQuery = (params = {}) => {
  return useQuery({
    queryKey: ['kpis', 'report', params],
    queryFn: async () => {
      const response = await api.get('/user-kpi-results/report', { params });
      return response.data?.data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
};

/**
 * Hook for submitting office report
 */
export const useSubmitReportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      await api.post('/user-kpi-results/report/submit', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
    },
  });
};

/**
 * Hook for fetching KPI year plans
 */
export const useKpiYearPlansQuery = () => {
  return useQuery({
    queryKey: ['kpi-year-plans'],
    queryFn: async () => {
      const response = await api.get('/kpi-year-plans');
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};
