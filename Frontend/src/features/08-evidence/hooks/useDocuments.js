import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;

// Every document the person may see: their own uploads and those of offices in their scope
export const useDocuments = () => useQuery({ queryKey: queryKeys.documents.list, queryFn: () => api.get('/documents').then(unwrap) });

export const useDocumentTypes = () => useQuery({ queryKey: queryKeys.documents.types, queryFn: () => api.get('/document-types').then(unwrap) });

/**
 * Documents, their types and the evidence built on them show up in each other's screens, so any change refreshes them.
 */
const useDocumentAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
};

export const useUploadDocument = () =>
  useDocumentAction(({ file, documentTypeId, ownerOfficeId, title, description }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentTypeId', documentTypeId);
    form.append('ownerOfficeId', ownerOfficeId);
    form.append('title', title);
    if (description) form.append('description', description);
    return api.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap);
  });

export const useDeleteDocument = () => useDocumentAction((id) => api.delete(`/documents/${id}`));

/**
 * Create a document type, or update one when an id is given.
 */
export const useSaveDocumentType = () => useDocumentAction(({ id, values }) => (id ? api.put(`/document-types/${id}`, values) : api.post('/document-types', values)).then(unwrap));

/**
 * Open a file in a new tab. The download needs the session, so it is fetched and shown from memory.
 */
export const openFile = async (fileId) => {
  const response = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
