import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

/**
 * System Monitoring. Each section loads when it is first scrolled to (enabled) and refreshes every few seconds only
 * while it is on screen (live), so a long page costs nothing for the parts nobody is looking at.
 */

const REFRESH_MS = 10_000;
const unwrap = ({ data }) => data.data;

const useMonitoringQuery = (name, path, { enabled = true, live = true, params } = {}) =>
  useQuery({
    queryKey: queryKeys.monitoring.section(name, params),
    queryFn: () => api.get(path, { params }).then(unwrap),
    enabled,
    refetchInterval: live ? REFRESH_MS : false,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

// The strip at the top always runs
export const useMonitoringOverview = () => useMonitoringQuery('overview', '/monitoring/overview');
export const useMonitoringHost = (view) => useMonitoringQuery('host', '/monitoring/host', view);
export const useMonitoringTraffic = (view) => useMonitoringQuery('traffic', '/monitoring/traffic', view);
export const useMonitoringDatabase = (view) => useMonitoringQuery('database', '/monitoring/database', view);
export const useMonitoringSecurity = (view) => useMonitoringQuery('security', '/monitoring/security', view);

// Saved history for the trend charts: an hour, a day or a week
export const useMonitoringHistory = (range, view) => useMonitoringQuery('history', '/monitoring/history', { ...view, params: { range } });

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId) => api.patch(`/monitoring/alerts/${alertId}/acknowledge`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.monitoring.all }),
  });
};
