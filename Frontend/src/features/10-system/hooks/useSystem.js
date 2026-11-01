import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';
import { applyPublicSettings } from '../lib/publicSettings';

const unwrap = ({ data }) => data.data;

export const useSettings = () => useQuery({ queryKey: queryKeys.system.settings, queryFn: () => api.get('/settings').then(unwrap) });

/**
 * A settings change can alter the name, logo or maintenance state shown everywhere, so the app reloads them.
 */
const useSettingsAction = (send) => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.system.settings });
      queryClient.invalidateQueries({ queryKey: queryKeys.system.audit });
      const { data } = await api.get('/settings/public');
      applyPublicSettings(dispatch, data.data);
    },
  });
};

export const useSaveSettings = () => useSettingsAction(({ group, settings }) => api.put(`/settings/${group}`, { settings }).then(unwrap));

export const useUploadLogo = () =>
  useSettingsAction((file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/files/logo', form).then(unwrap);
  });

export const useAuditLogs = (params) =>
  useQuery({
    queryKey: [...queryKeys.system.audit, 'list', params],
    queryFn: () => api.get('/audit-logs', { params }).then(({ data }) => data),
    placeholderData: keepPreviousData,
  });

export const useAuditFilters = () => useQuery({ queryKey: [...queryKeys.system.audit, 'filters'], queryFn: () => api.get('/audit-logs/filters').then(unwrap) });

export const useAuditLog = (id) => useQuery({ queryKey: [...queryKeys.system.audit, 'entry', id], queryFn: () => api.get(`/audit-logs/${id}`).then(unwrap) });
