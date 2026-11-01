import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';
import { useRefreshMe } from '../../01-identity/hooks/useProfile';

const unwrap = ({ data }) => data.data;

export const useRolesQuery = (params = {}) =>
  useQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => api.get('/roles', { params }).then(unwrap),
  });

export const usePermissionCatalog = () =>
  useQuery({
    queryKey: queryKeys.roles.permissions,
    queryFn: () => api.get('/permissions').then(unwrap),
  });

/**
 * A role change can touch offices, user pages and the signed-in person's own access, so it refreshes them all.
 */
const useRoleAction = (send) => {
  const queryClient = useQueryClient();
  const refreshMe = useRefreshMe();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.offices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      return refreshMe();
    },
  });
};

export const useSaveRole = () => useRoleAction(({ id, values }) => (id ? api.put(`/roles/${id}`, values) : api.post('/roles', values)).then(unwrap));
export const useDeleteRole = () => useRoleAction((id) => api.delete(`/roles/${id}`));
export const useSaveRolePermissions = () => useRoleAction(({ id, permissionCodes }) => api.post(`/roles/${id}/permissions`, { permissionCodes }).then(unwrap));
export const useAssignRole = () => useRoleAction(({ placementId, values }) => api.post(`/office-persons/${placementId}/roles`, values).then(unwrap));
export const useRevokeRole = () => useRoleAction((assignmentId) => api.delete(`/office-person-roles/${assignmentId}`));
