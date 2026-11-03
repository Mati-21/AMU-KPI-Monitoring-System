import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';

const unwrap = ({ data }) => data.data;

// Offices whose performance the person may open this year, their own first
export const usePerformanceOffices = (fiscalYearId) =>
  useQuery({
    queryKey: queryKeys.reports.offices(fiscalYearId),
    queryFn: () => api.get('/performance/offices', { params: { fiscalYearId } }).then(unwrap),
    enabled: Boolean(fiscalYearId),
  });

// An office's year laid out for entering results: a section per reporting frequency, a column per period
export const usePerformanceSheet = (fiscalYearId, officeId) =>
  useQuery({
    queryKey: queryKeys.reports.sheet(fiscalYearId, officeId),
    queryFn: () => api.get('/performance/sheet', { params: { fiscalYearId, officeId } }).then(unwrap),
    enabled: Boolean(fiscalYearId && officeId),
  });

// A staff contract's year laid out for entering results, for its person and whoever reviews them
export const useStaffSheet = (contractId) =>
  useQuery({
    queryKey: [...queryKeys.reports.all, 'sheet', 'contract', contractId],
    queryFn: () => api.get('/performance/sheet', { params: { contractId } }).then(unwrap),
    enabled: Boolean(contractId),
  });

// Approved results added up for the year, a column per office below
export const useYearReport = (fiscalYearId, officeId) =>
  useQuery({
    queryKey: queryKeys.reports.year(fiscalYearId, officeId),
    queryFn: () => api.get('/performance/year-report', { params: { fiscalYearId, officeId } }).then(unwrap),
    enabled: Boolean(fiscalYearId && officeId),
  });

export const useReports = (params) =>
  useQuery({
    queryKey: queryKeys.reports.list(params),
    queryFn: () => api.get('/reports', { params }).then(unwrap),
    enabled: Boolean(params.fiscalYearId),
  });

export const useReport = (id) =>
  useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: () => api.get(`/reports/${id}`).then(unwrap),
  });

export const useDocumentTypes = () => useQuery({ queryKey: ['document-types'], queryFn: () => api.get('/document-types').then(unwrap) });

const useReportAction = (send) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
  });
};

/**
 * Save one period's results from the performance sheet, starting its report the first time, and submit it if asked.
 * Resolves to the report's id.
 */
export const useSavePeriod = () =>
  useReportAction(async ({ contractId, periodId, reportId, values, submit }) => {
    const id = reportId ?? (await api.post('/reports', { contractId, reportingPeriodId: periodId }).then(unwrap)).id;
    if (values.length > 0) await api.put(`/reports/${id}/values`, { values });
    if (submit) await api.patch(`/reports/${id}/submit`);
    return id;
  });

export const useSaveResults = () => useReportAction(({ id, values }) => api.put(`/reports/${id}/values`, { values }).then(unwrap));
// The Super Admin lets one office submit a period after its deadline and grace period
export const useAllowLate = () => useReportAction((values) => api.post('/reports/allow-late', values).then(unwrap));
// step: submit, start-review, review or reopen
export const useReportStep = () => useReportAction(({ id, step, values }) => api.patch(`/reports/${id}/${step}`, values ?? {}).then(unwrap));

/**
 * Evidence is a document of the reporting office linked to one result: the file is uploaded first, then attached.
 */
export const useAttachEvidence = () =>
  useReportAction(async ({ valueId, officeId, documentTypeId, title, file }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentTypeId', documentTypeId);
    form.append('ownerOfficeId', officeId);
    form.append('title', title);
    const document = await api.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap);
    return api.post(`/performance-values/${valueId}/evidence`, { documentId: document.id }).then(unwrap);
  });

export const useRemoveEvidence = () => useReportAction((id) => api.delete(`/performance-evidence/${id}`));
export const useVerifyEvidence = () => useReportAction(({ id, status, comment }) => api.patch(`/performance-evidence/${id}/verify`, { status, comment }).then(unwrap));

/**
 * Open an evidence file in a new tab. The download needs the session, so it is fetched and shown from memory.
 */
export const openFile = async (fileId) => {
  const response = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
