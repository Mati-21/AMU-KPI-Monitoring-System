import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;

const useOfficeQuery = (name, officeId, path) =>
  useQuery({
    queryKey: queryKeys.offices.part(officeId, name),
    queryFn: () => api.get(`/offices/${officeId}${path}`).then(unwrap),
    enabled: Boolean(officeId),
  });

export const useOfficeTree = () => useQuery({ queryKey: queryKeys.offices.tree, queryFn: () => api.get('/offices/tree').then(unwrap) });
export const useOfficeList = () => useQuery({ queryKey: queryKeys.offices.list, queryFn: () => api.get('/offices').then(unwrap) });
export const useOfficeTypes =() => useQuery({ queryKey: queryKeys.offices.types, queryFn: () => api.get('/office-types').then(unwrap) });
export const useOffice = (officeId) => useOfficeQuery('detail', officeId, '');
export const usePositions = (officeId) => useOfficeQuery('positions', officeId, '/positions');
export const useMembers = (officeId) => useOfficeQuery('members', officeId, '/members');
export const useOfficeHistory = (officeId) => useOfficeQuery('history', officeId, '/history');

/**
 * Offices, positions and placements show up in several places, including user pages, so a change refreshes them all.
 */
const useOfficeAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
};

export const useSaveOffice = () => useOfficeAction(({ id, values }) => (id ? api.put(`/offices/${id}`, values) : api.post('/offices', values)).then(unwrap));
export const useSaveOfficeType = () => useOfficeAction(({ id, values }) => (id ? api.put(`/office-types/${id}`, values) : api.post('/office-types', values)).then(unwrap));
export const useDeleteOfficeType = () => useOfficeAction((id) => api.delete(`/office-types/${id}`));
export const useSavePosition = () => useOfficeAction(({ id, officeId, values }) => (id ? api.put(`/positions/${id}`, values) : api.post(`/offices/${officeId}/positions`, values)).then(unwrap));
export const useDeletePosition = () => useOfficeAction((id) => api.delete(`/positions/${id}`));
export const usePlaceMember = () => useOfficeAction(({ officeId, values }) => api.post(`/offices/${officeId}/members`, values).then(unwrap));
export const useEndPlacement = () => useOfficeAction(({ id, endDate }) => api.patch(`/office-persons/${id}/end`, { endDate }).then(unwrap));
