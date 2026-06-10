import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';
import { emitReportDataChanged } from '../../lib/utils';

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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * Hook for fetching all units
 */
export const useUnitsQuery = () => {
  return useQuery({
    queryKey: queryKeys.kpis.units,
    queryFn: async () => {
      const response = await api.get('/units');
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
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
      emitReportDataChanged();
    },
  });
};

/**
 * Hook for bulk assigning user KPIs
 */
export const useBulkAssignUserKpisMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignments) => {
      const response = await api.post('/user-kpis/bulk-assign', { assignments });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      emitReportDataChanged();
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
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.kpis.all });

      // Snapshot previous assignments
      const previousAssignments = queryClient.getQueriesData({ queryKey: ['kpis', 'assignments'] });

      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: ['kpis', 'assignments'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) => (String(item.Id) === String(id) ? { ...item, ...data } : item));
      });

      return { previousAssignments };
    },
    onError: (err, variables, context) => {
      // Roll back
      if (context?.previousAssignments) {
        context.previousAssignments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      emitReportDataChanged();
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
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.kpis.all });

      // Snapshot previous assignments
      const previousAssignments = queryClient.getQueriesData({ queryKey: ['kpis', 'assignments'] });

      // Optimistically remove the item
      queryClient.setQueriesData({ queryKey: ['kpis', 'assignments'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item) => String(item.Id) !== String(id));
      });

      return { previousAssignments };
    },
    onError: (err, id, context) => {
      // Roll back
      if (context?.previousAssignments) {
        context.previousAssignments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      emitReportDataChanged();
    },
  });
};

/**
 * Hook for bulk deleting user KPI assignments
 */
export const useBulkDeleteUserKpisMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids) => {
      await api.post('/user-kpis/bulk-delete', { ids });
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.kpis.all });
      const previousAssignments = queryClient.getQueriesData({ queryKey: ['kpis', 'assignments'] });

      const idsSet = new Set(ids.map(String));

      queryClient.setQueriesData({ queryKey: ['kpis', 'assignments'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((item) => !idsSet.has(String(item.Id)));
      });

      return { previousAssignments };
    },
    onError: (err, ids, context) => {
      if (context?.previousAssignments) {
        context.previousAssignments.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      emitReportDataChanged();
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
    mutationFn: async ({ id, remark }) => {
      await api.patch(`/user-kpi-results/${id}/approve`, { remark });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
      emitReportDataChanged();
    },
  });
};

/**
 * Hook for adjusting and approving a KPI result
 */
export const useAdjustKpiMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, adjustedValue, remark }) => {
      await api.patch(`/user-kpi-results/${id}/adjust`, { adjustedValue, remark });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
      queryClient.invalidateQueries({ queryKey: ['kpis', 'report'] });
      emitReportDataChanged();
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
      emitReportDataChanged();
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
      emitReportDataChanged();
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

/**
 * Hook for fetching cycle years (closed years + current year) and the active cycle year.
 * Response shape: { activeCycleYear: string, years: string[] }
 */
export const useCycleYearsQuery = () => {
  return useQuery({
    queryKey: ['kpi-year-plans', 'cycle-years'],
    queryFn: async () => {
      const response = await api.get('/kpi-year-plans/cycle-years');
      return response.data?.data || { activeCycleYear: '', years: [] };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

/**
 * Hook for checking if the current cycle is ready to close (all reports submitted + all results approved).
 */
export const useCycleReadinessQuery = (cycleYear, enabled = true) => {
  return useQuery({
    queryKey: ['kpi-year-plans', 'cycle-readiness', cycleYear],
    queryFn: async () => {
      const response = await api.get('/kpi-year-plans/cycle-readiness', {
        params: cycleYear ? { cycleYear } : {},
      });
      return response.data?.data || { ready: false, pendingRoles: [], pendingResultCount: 0 };
    },
    enabled,
    staleTime: 1000 * 30, // 30 seconds — poll frequently for live status
    gcTime: 1000 * 60 * 2,
  });
};

/**
 * Hook for closing the current KPI cycle and creating the next one.
 */
export const useCloseCycleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cycleYear) => {
      const response = await api.post('/kpi-year-plans/close-year', cycleYear ? { cycleYear } : {});
      return response.data;
    },
    onSuccess: () => {
      // Invalidate everything — new cycle means all data changes
      queryClient.invalidateQueries();
    },
  });
};
