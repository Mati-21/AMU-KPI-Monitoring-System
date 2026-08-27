import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true, // Only fetch on focus if data is stale
      staleTime: 1000 * 60 * 5, // 5 minutes - keep data "fresh" longer for instant loads
      gcTime: 1000 * 60 * 30, // 30 minutes cache keeping (garbage collection time)
      refetchOnMount: true, // Fetch on mount if data is stale
      refetchOnReconnect: true, // Automatically background fetch on network reconnect
    },
  },
});
