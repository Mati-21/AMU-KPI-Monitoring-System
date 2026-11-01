import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';
import { fetchAllKpis } from '../../04-kpi-catalog/hooks/useCatalog';

const unwrap = ({ data }) => data.data;

export const useContracts = (fiscalYearId) =>
  useQuery({
    queryKey: queryKeys.contracts.list(fiscalYearId),
    queryFn: () => api.get('/contracts', { params: { fiscalYearId } }).then(unwrap),
    enabled: Boolean(fiscalYearId),
  });

export const useContract = (id) =>
  useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => api.get(`/contracts/${id}`).then(unwrap),
    enabled: Boolean(id),
  });

export const useRejections = (fiscalYearId) =>
  useQuery({
    queryKey: queryKeys.contracts.rejections(fiscalYearId),
    queryFn: () => api.get('/contract-rejections', { params: { fiscalYearId } }).then(unwrap),
    enabled: Boolean(fiscalYearId),
  });

export const useAllocations = (assignmentId) =>
  useQuery({
    queryKey: [...queryKeys.contracts.all, 'allocations', assignmentId],
    queryFn: () => api.get(`/assignments/${assignmentId}/allocations`).then(unwrap),
  });

export const useAllKpis = () => useQuery({ queryKey: queryKeys.catalog.part('kpis', 'all'), queryFn: () => fetchAllKpis() });

// Fiscal years count their contracts and KPIs count their assignments, so a change refreshes both sides
const useContractAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });
    },
  });
};

export const useCreateContract = () => useContractAction((values) => api.post('/contracts', values).then(unwrap));

// One step of a workflow: submit, approve, reject, sign and so on
export const useContractStep = () => useContractAction(({ id, step, values }) => api.patch(`/contracts/${id}/${step}`, values ?? {}).then(unwrap));
export const useAssignmentStep = () => useContractAction(({ id, step, values }) => api.patch(`/assignments/${id}/${step}`, values ?? {}).then(unwrap));

export const useSaveAllocations = () => useContractAction(({ id, values }) => api.put(`/assignments/${id}/allocations`, values).then(unwrap));

export const useSaveAssignment = () => useContractAction(({ id, contractId, values }) => (id ? api.put(`/assignments/${id}`, values) : api.post(`/contracts/${contractId}/assignments`, values)).then(unwrap));
