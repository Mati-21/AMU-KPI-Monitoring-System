import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;
const YEARS_KEY = queryKeys.catalog.part('fiscal-years');
const PERIODS_KEY = queryKeys.catalog.part('reporting-periods');

export const useFiscalYears = () => useQuery({ queryKey: YEARS_KEY, queryFn: () => api.get('/fiscal-years').then(unwrap) });

export const usePeriods = (fiscalYearId) =>
  useQuery({
    queryKey: [...PERIODS_KEY, fiscalYearId],
    queryFn: () => api.get('/reporting-periods', { params: { fiscalYearId } }).then(unwrap),
    enabled: Boolean(fiscalYearId),
  });

// Years show how many periods they have, so a change to either refreshes both
const usePlanningAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: send, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all }) });
};

export const useSaveYear = () => usePlanningAction(({ id, values }) => (id ? api.put(`/fiscal-years/${id}`, values) : api.post('/fiscal-years', values)).then(unwrap));
export const useYearStatus = (action) => usePlanningAction(({ id, values }) => api.patch(`/fiscal-years/${id}/${action}`, values ?? {}).then(unwrap));

export const useSavePeriod = () => usePlanningAction(({ id, values }) => (id ? api.put(`/reporting-periods/${id}`, values) : api.post('/reporting-periods', values)).then(unwrap));
export const useGeneratePeriods = () => usePlanningAction(({ fiscalYearId, frequencyId }) => api.post(`/fiscal-years/${fiscalYearId}/reporting-periods/generate`, { frequencyId }).then(unwrap));
export const usePeriodStatus = (action) => usePlanningAction(({ id, values }) => api.patch(`/reporting-periods/${id}/${action}`, values ?? {}).then(unwrap));
export const useDeletePeriod = () => usePlanningAction((id) => api.delete(`/reporting-periods/${id}`));
