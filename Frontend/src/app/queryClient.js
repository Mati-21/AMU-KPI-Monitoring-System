import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: 'always', // Keep data fresh in background
      staleTime: 1000 * 60 * 5, // 5 minutes - keep data "fresh" longer for instant loads
      gcTime: 1000 * 60 * 15, // 15 minutes
      refetchOnMount: false, // Don't refetch on every mount if data is fresh
    },
  },
});
