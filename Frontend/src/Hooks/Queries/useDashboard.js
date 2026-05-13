import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching administrative dashboard summary
 */
export const useAdminDashboardQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.admin,
    queryFn: async () => {
      const response = await api.get('/admin-dashboard/summary');
      return response.data?.data;
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
};
