import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const useRefreshPeople = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
};

const useAccountAction = (send) => {
  const refreshPeople = useRefreshPeople();
  return useMutation({ mutationFn: send, onSuccess: refreshPeople });
};

export const usePersons = (params, { enabled = true } = {}) =>
  useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.get('/persons', { params }).then(({ data }) => data),
    placeholderData: keepPreviousData,
    enabled,
  });

export const usePerson = (personId) =>
  useQuery({
    queryKey: queryKeys.users.detail(personId),
    queryFn: () => api.get(`/persons/${personId}`).then(({ data }) => data.data),
  });

export const useCreatePerson = () => useAccountAction((values) => api.post('/persons', values));
export const useUpdatePerson = () => useAccountAction(({ personId, values }) => api.put(`/persons/${personId}`, values));
export const useArchivePerson = () => useAccountAction((personId) => api.delete(`/persons/${personId}`));
export const useSaveAccount = () => useAccountAction(({ personId, values }) => api.post(`/persons/${personId}/account`, values));
export const useSetAccountActive = () => useAccountAction(({ accountId, isActive }) => api.patch(`/users/${accountId}/toggle-active`, { isActive }));
export const useResetPassword = () => useAccountAction(({ accountId, temporaryPassword }) => api.post(`/users/${accountId}/reset-password`, { temporaryPassword }));
export const useEnforceMfa = () => useAccountAction(({ accountId, enforced }) => api.patch(`/auth/users/${accountId}/enforce-mfa`, { enforced }));

export const useAccountSessions = (accountId) =>
  useQuery({
    queryKey: [...queryKeys.users.all, 'sessions', accountId],
    queryFn: () => api.get(`/users/${accountId}/sessions`).then(({ data }) => data.data),
    enabled: Boolean(accountId),
  });

export const useRevokeAccountSessions = () => useAccountAction((accountId) => api.post(`/users/${accountId}/sessions/revoke-all`));

/**
 * Still used by the KPI allocation page. That route no longer exists; it goes when Module 05 is connected.
 */
export const useUserRolesQuery = (params = {}) =>
  useQuery({
    queryKey: ['user-roles', params],
    queryFn: () => api.get('/user-roles', { params }).then(({ data }) => data.data ?? data),
  });
