import { useQuery } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;
const viewParams = (fiscalYearId, reportingPeriodId) => ({ fiscalYearId, ...(reportingPeriodId && { reportingPeriodId }) });

// The signed-in person's own staff contract
export const useMyDashboard = (fiscalYearId, reportingPeriodId, enabled = true) => {
  const params = viewParams(fiscalYearId, reportingPeriodId);
  return useQuery({
    queryKey: queryKeys.dashboard.me(params),
    queryFn: () => api.get('/dashboards/me', { params }).then(unwrap),
    enabled: Boolean(enabled && fiscalYearId),
  });
};

// One office: its score, KPIs, trend, deadlines, feedback and staff
export const useOfficeDashboard = (officeId, fiscalYearId, reportingPeriodId) => {
  const params = viewParams(fiscalYearId, reportingPeriodId);
  return useQuery({
    queryKey: queryKeys.dashboard.office(officeId, params),
    queryFn: () => api.get(`/dashboards/offices/${officeId}`, { params }).then(unwrap),
    enabled: Boolean(officeId && fiscalYearId),
  });
};

// The offices directly below one office, compared, with their outstanding reports
export const useOfficesBelowDashboard = (officeId, fiscalYearId, reportingPeriodId, enabled = true) => {
  const params = viewParams(fiscalYearId, reportingPeriodId);
  return useQuery({
    queryKey: queryKeys.dashboard.below(officeId, params),
    queryFn: () => api.get(`/dashboards/offices/${officeId}/subordinates`, { params }).then(unwrap),
    enabled: Boolean(enabled && officeId && fiscalYearId),
  });
};

// The Super Admin's system overview: counts, usage and recent activity
export const useSystemDashboard = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.dashboard.system,
    queryFn: () => api.get('/dashboards/system').then(unwrap),
    enabled,
  });

// People who logged in and logins: today by the hour, or the last 7 or 30 days by the day
export const useSystemUsage = (range) =>
  useQuery({
    queryKey: queryKeys.dashboard.systemUsage(range),
    queryFn: () => api.get('/dashboards/system/usage', { params: { range } }).then(unwrap),
    placeholderData: (previous) => previous,
  });

// The whole university, every office compared by level
export const useUniversityDashboard = (fiscalYearId, reportingPeriodId, enabled = true) => {
  const params = viewParams(fiscalYearId, reportingPeriodId);
  return useQuery({
    queryKey: queryKeys.dashboard.university(params),
    queryFn: () => api.get('/dashboards/university', { params }).then(unwrap),
    enabled: Boolean(enabled && fiscalYearId),
    // Refused for heads below the top office; that only means the option is not theirs
    retry: false,
  });
};
