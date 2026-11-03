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

// The person's own staff contracts for a year
export const useMyContracts = (fiscalYearId) =>
  useQuery({
    queryKey: [...queryKeys.contracts.list(fiscalYearId), 'mine'],
    queryFn: () => api.get('/contracts', { params: { fiscalYearId, mine: true } }).then(unwrap),
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

// Offices a new contract can be created for: directly below the person's own office
export const useContractOffices = (enabled) =>
  useQuery({
    queryKey: [...queryKeys.contracts.all, 'offices'],
    queryFn: () => api.get('/contract-offices').then(unwrap),
    enabled,
  });

// People working in the person's own office, who can be given a staff contract
export const useContractPeople = (enabled) =>
  useQuery({
    queryKey: [...queryKeys.contracts.all, 'people'],
    queryFn: () => api.get('/contract-people').then(unwrap),
    enabled,
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

// How much of a received KPI the office does itself
export const useKeepPart = () => useContractAction(({ id, amount }) => api.put(`/assignments/${id}/kept`, { amount }).then(unwrap));

// Checking a file changes nothing, so it refreshes nothing
export const useCheckContractImport = () => useMutation({ mutationFn: ({ id, rows }) => api.post(`/contracts/${id}/kpi-import`, { rows, dryRun: true }).then(unwrap) });
export const useContractImport = () => useContractAction(({ id, rows }) => api.post(`/contracts/${id}/kpi-import`, { rows }).then(unwrap));

export const useSaveAssignment = () => useContractAction(({ id, contractId, values }) => (id ? api.put(`/assignments/${id}`, values) : api.post(`/contracts/${contractId}/assignments`, values)).then(unwrap));
