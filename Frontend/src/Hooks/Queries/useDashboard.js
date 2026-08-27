import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching administrative dashboard summary
 */
export const useAdminDashboardQuery = (cycleYear) => {
  return useQuery({
    queryKey: [...queryKeys.dashboard.admin, cycleYear],
    queryFn: async () => {
      const response = await api.get('/admin-dashboard/summary', { params: { cycleYear } });
      return response.data?.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchInterval: 1000 * 60 * 5, // Automatically refresh every 5 minutes in background
    refetchIntervalInBackground: true, // Keep refreshing even when tab is not focused
    placeholderData: keepPreviousData, // Keep showing previous data while refetching new cycleYear
  });
};
