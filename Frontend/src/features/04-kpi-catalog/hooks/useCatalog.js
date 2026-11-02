import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;

const useCatalogList = (path) => useQuery({ queryKey: queryKeys.catalog.part(path), queryFn: () => api.get(`/${path}`).then(unwrap) });

export const useThemeTree = () => useCatalogList('kpi-themes');
export const useUnits = () => useCatalogList('measurement-units');
export const useFrequencies = () => useCatalogList('reporting-frequencies');
export const useScales = () => useCatalogList('kpi-scales');
export const useCurrencies = () => useCatalogList('currencies');
export const useExchangeRates = () => useCatalogList('exchange-rates');

export const useKpis = (params) =>
  useQuery({
    queryKey: queryKeys.catalog.part('kpis', params),
    queryFn: () => api.get('/kpis', { params }).then(({ data }) => data),
    placeholderData: keepPreviousData,
  });

/**
 * Catalog records appear in each other's forms and in KPI lists, so any change refreshes them all.
 */
const useCatalogAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: send, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all }) });
};

/**
 * Create at /path, or update at /path/id when an id is given.
 */
export const useSaveRecord = (path) => useCatalogAction(({ id, values }) => (id ? api.put(`/${path}/${id}`, values) : api.post(`/${path}`, values)).then(unwrap));

export const useCheckKpiImport = () => useMutation({ mutationFn: (rows) => api.post('/kpis/import', { rows, dryRun: true }).then(unwrap) });
export const useImportKpis = () => useCatalogAction((rows) => api.post('/kpis/import', { rows }).then(unwrap));

export const useSetScaleScoring =() => useCatalogAction(({ id, approved }) => api.patch(`/kpi-scales/${id}/scoring`, { approved }).then(unwrap));

/**
 * Every KPI matching the filters, page by page, for the Excel file.
 */
export const fetchAllKpis = async (params) => {
  const limit = 100;
  const rows = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.get('/kpis', { params: { ...params, page, limit } });
    rows.push(...data.data);
    if (page >= data.pagination.totalPages) return rows;
  }
};
