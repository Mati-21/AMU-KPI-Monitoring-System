import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  RefreshCw,
  Clock3,
  ChevronDown,
  ChevronUp,
  Plus,
  Eye,
  Send,
  Check,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import PerformanceSubmitModal from '../../Components/KPI/PerformanceSubmitModal';
import PerformanceDetailModal from '../../Components/KPI/PerformanceDetailModal';
import { useSubmitPerformanceMutation, useReportQuery, useSubmitReportMutation, useCycleReadinessQuery, useCloseCycleMutation } from '../../Hooks/Queries/useKpis';
import { useNotification } from '../../Context/NotificationContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../Config/queryKeys';

import Button from '../../Components/UI/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import { Badge } from '../../Components/UI/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/UI/Table';
import { ScrollArea } from '../../Components/UI/scroll-area';
import { api } from '../../api/axios';
import permissionUtils from '../../lib/permissionUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../Components/UI/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import { AlertCircle } from 'lucide-react';

const REPORT_PERMISSION_KEYS = [
  permissionUtils.permissionKey('view', 'KPI Reporting'),
  permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
  permissionUtils.permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

const formatCellValue = (value) => {
  const rawValue = value && typeof value === 'object' ? value.value : value;

  if (rawValue === 'N/A') return 'N/A';
  if (rawValue === '' || rawValue === ' ') return '';
  if (rawValue === null || rawValue === undefined || rawValue === '—') {
    return '-';
  }

  return rawValue;
};

const isPendingDisplayCell = (value) =>
  Boolean(value && typeof value === 'object' && (value.approved === false || value.isApproved === false) && value.showPendingValue !== false);

const MAX_COLUMN_NAME_LENGTH = 35;

const truncateColumnName = (name) => {
  const label = String(name || '').trim();
  if (label.length <= MAX_COLUMN_NAME_LENGTH) return label;
  return label.slice(0, MAX_COLUMN_NAME_LENGTH) + '…';
};

const getRowClassName = (rowType) => {
  if (rowType === 'stable') return 'bg-primary/10 font-bold';
  if (rowType === 'theme') return 'bg-primary/5 font-semibold';
  if (rowType === 'subTheme') return 'bg-primary/2 font-medium';
  if (rowType === 'subTotal') return 'report-subtotal-row bg-muted/50 font-semibold';
  return 'hover:bg-muted/30';
};

const getRowLabelClassName = (rowType) => {
  if (rowType === 'stable') return '';
  if (rowType === 'theme') return 'pl-4';
  if (rowType === 'subTheme') return 'pl-8';
  if (rowType === 'subTotal') return 'pl-8 uppercase tracking-wide';
  return 'pl-10';
};

const OfficeReport = () => {
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const canViewReport = permissionUtils.hasPermission(userPermissions, REPORT_PERMISSION_KEYS);

  useEffect(() => {
    const handleDataChange = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('amu:report-data-changed', handleDataChange);
      window.addEventListener('storage', (event) => {
        if (event.key === 'amu:report-data-changed') {
          handleDataChange();
        }
      });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('amu:report-data-changed', handleDataChange);
      }
    };
  }, [queryClient]);

  const [selectedScopeRoleId, setSelectedScopeRoleId] = useState('');
  const [expandedColumns, setExpandedColumns] = useState({});
  const [selectedReportType, setSelectedReportType] = useState('original');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedCycleYear, setSelectedCycleYear] = useState('');
  const [selectedReportMode, setSelectedReportMode] = useState('individual');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState(null);
  const [submissionInitialValues, setSubmissionInitialValues] = useState(null);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  const submitPerformanceMutation = useSubmitPerformanceMutation();

  // Queries
  const reportParams = {
    reportType: selectedReportType,
    roleId: selectedScopeRoleId,
    cycleYear: selectedCycleYear,
    reportMode: selectedReportMode,
    quarter: selectedQuarter || undefined,
  };

  const { data: reportData, isLoading: loading, error: queryError } = useReportQuery(reportParams);
  const error = queryError?.response?.data?.message || '';

  // Mutations
  const submitReportMutation = useSubmitReportMutation();
  const submittingReport = submitReportMutation.isPending;
  const closeCycleMutation = useCloseCycleMutation();

  const toggleColumnExpand = (columnId) => {
    setExpandedColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  useEffect(() => {
    if (!selectedScopeRoleId && reportData?.availableScopeRoles?.length) {
      setSelectedScopeRoleId(String(reportData.scopeRole?.id || reportData.availableScopeRoles[0].id));
    }
  }, [reportData, selectedScopeRoleId]);

  useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      try {
        const res = await api.get('/kpi-year-plans');
        if (!mounted) return;
        const plans = res.data?.data || [];
        const years = [...new Set(plans.map((p) => p.CycleYear))].sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
      } catch (err) {
        console.error('Failed to load cycle years', err);
      }
    };
    fetchYears();
    return () => {
      mounted = false;
    };
  }, []);

  const columns = reportData?.columns || [];
  const allRows = reportData?.rows || [];
  const rows = allRows.filter((row) => {
    const rowType = String(row?.rowType || 'kpi');
    return rowType === 'kpi' || rowType === 'leaf';
  });
  const hasKpiRows = rows.length > 0;
  const currentOfficeName = reportData?.scopeRole?.name || authUser?.roleName || authUser?.role || 'Current Office';
  const scopeRoleOptions = reportData?.availableScopeRoles || [];
  const showScopeSelector = scopeRoleOptions.length > 0;
  const showReportModeSelector = reportData?.scopeRoleIsDistributable || reportData?.availableScopeRoles?.length > 0;

  const isMeasurer = reportData?.scopeRoleHasExtraMeasures;
  const isSubordinateOfMeasurer = reportData?.isSubordinateOfMeasurer;

  // Root role = the one with no parent role (Strategic Office)
  // We check the authenticated user's normalized role hierarchy
  const isRootRole = authUser && authUser.parentRoleId === null;
  const activeCycleYear = selectedCycleYear || (availableYears[0] || '2018');

  // Cycle readiness — only fetch for root roles
  const { data: cycleReadiness } = useCycleReadinessQuery(activeCycleYear, isRootRole);
  const cycleReady = cycleReadiness?.ready === true;
  const pendingRoles = cycleReadiness?.pendingRoles || [];
  const pendingResultCount = cycleReadiness?.pendingResultCount || 0;

  const handleCloseCycle = () => {
    closeCycleMutation.mutate(activeCycleYear, {
      onSuccess: (data) => {
        notify(`Cycle ${activeCycleYear} closed. New cycle ${data?.data?.nextCycleYear} is now active.`, 'success');
        setIsCloseDialogOpen(false);
      },
      onError: (err) => {
        notify(err?.response?.data?.message || 'Failed to close cycle.', 'error');
        setIsCloseDialogOpen(false);
      },
    });
  };

  const isCombinedMode = reportData?.reportMode === 'combined';

  // Calculate if the entire view has pending items
  const hasPendingItems = rows.some((row) =>
    columns.some((col) => isPendingDisplayCell(row.values?.[col.id]))
  );

  const handleOpenSubmit = (row) => {
    setActiveKpi({
      id: row.assignmentId,
      kpiId: row.kpiId,
      name: row.kpi,
      unit: row.unit,
      target: row.target,
      baseline: row.baseline,
      quarterlyResults: row.quarterlyResults || [],
    });
    setSubmissionInitialValues({
      quarter: '',
      result: '',
      remark: '',
    });
    setSubmissionModalOpen(true);
  };

  const handleOpenDetail = (row) => {
    setActiveKpi({
      id: row.assignmentId,
      kpiId: row.kpiId,
      name: row.kpi,
      unit: row.unit,
      target: row.target,
      baseline: row.baseline,
      weight: row.weight,
      evidenceRequired: row.isEvidenceRequired,
      quarterlyResults: row.allQuarterlyResults || row.quarterlyResults || [],
      allEvidenceUrls: row.allEvidenceUrls || [],
    });
    setDetailModalOpen(true);
  };

  return (
    <div className="flex-1 min-h-full w-full space-y-6 p-6 overflow-auto">
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report</h1>
          <p className="text-sm text-muted-foreground">KPI report by office scope with child and sub-child performance roll-up</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-1 font-semibold text-foreground">
                -
              </span>
              <span>means no performance submitted yet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-1 font-semibold text-foreground">
                N/A
              </span>
              <span>means not allocated</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            {showScopeSelector ? (
              <>
                <span className="text-xs font-medium text-muted-foreground">Report Scope</span>
                <select
                  value={selectedScopeRoleId || String(reportData?.scopeRole?.id || '')}
                  onChange={(event) => setSelectedScopeRoleId(event.target.value)}
                  className="min-w-70 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none"
                >
                  {scopeRoleOptions.map((scopeRole) => (
                    <option key={scopeRole.id} value={scopeRole.id}>
                      {scopeRole.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}


            {showReportModeSelector ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">View Mode</span>
                <select
                  value={selectedReportMode}
                  onChange={(event) => setSelectedReportMode(event.target.value)}
                  className="min-w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none"
                >
                  <option value="individual">Individual</option>
                  <option value="combined">Combined</option>
                </select>
              </div>
            ) : null}

            {availableYears.length > 0 && (
              <>
                <span className="text-xs font-medium text-muted-foreground">Year</span>
                <select
                  value={selectedCycleYear}
                  onChange={(event) => setSelectedCycleYear(event.target.value)}
                  className="min-w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none"
                >
                  <option value="">2018</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Quarter</span>
              <select
                value={selectedQuarter}
                onChange={(event) => setSelectedQuarter(event.target.value)}
                className="min-w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none"
              >
                <option value="">Progressive</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {hasPendingItems && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">
                <Clock3 className="mr-1 h-3 w-3" />
                Pending Approval
              </Badge>
            )}
            {loading ? <Badge variant="secondary">Loading...</Badge> : null}
            {reportData?.canSubmit ? (
              <Button
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
                disabled={submittingReport}
                onClick={() => setIsSubmitDialogOpen(true)}
              >
                <Send className="h-4 w-4" />
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </Button>
            ) : reportData?.isSubmitted && reportData.parentRole ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                <Check className="h-4 w-4" />
                Report Submitted
              </div>
            ) : null}
            {isRootRole ? (
              <Button
                type="button"
                size="sm"
                className={cn(
                  'flex items-center gap-2 h-9 transition-all',
                  cycleReady && reportData?.quarter === 'Q4'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
                disabled={!cycleReady || reportData?.quarter !== 'Q4' || closeCycleMutation.isPending}
                title={
                  reportData?.quarter !== 'Q4'
                    ? 'Not ready: All 4 quarters must be submitted to validate and close.'
                    : !cycleReady
                      ? `Not ready: ${pendingRoles.length} roles pending, ${pendingResultCount} results unapproved`
                      : 'All reports approved — close this cycle'
                }
                onClick={() => setIsCloseDialogOpen(true)}
              >
                <ShieldCheck className="h-4 w-4" />
                {closeCycleMutation.isPending ? 'Closing...' : 'Validate & Close Cycle'}
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" className="flex items-center gap-2 h-9" onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all })}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card className="border-border shadow-sm">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-xl font-bold">
              KPI Report for {currentOfficeName}
            </CardTitle>
            {reportData?.quarter && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-4 py-1.5 rounded-md shadow-sm text-sm uppercase tracking-widest whitespace-nowrap">
                {reportData.quarter === 'Q4' ? 'Full Year' : reportData.quarter}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-hidden rounded-b-lg border-t border-border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center font-bold">No.</TableHead>
                    <TableHead className="min-w-50 font-bold">KPI</TableHead>
                    <TableHead className="w-24 text-center font-bold">Unit</TableHead>
                    <TableHead className="w-24 text-center font-bold">Weight</TableHead>
                    <TableHead className="w-24 text-center font-bold">Baseline</TableHead>
                    <TableHead className="w-24 text-center font-bold">Target</TableHead>
                    {columns.map((column) => {
                      const fullName = String(column.name || '').trim();
                      const isLong = fullName.length > MAX_COLUMN_NAME_LENGTH;
                      const isExpanded = expandedColumns[column.id];
                      const displayName = isExpanded ? fullName : truncateColumnName(fullName);
                      const isSubmitted = column.isSubmitted;

                      return (
                        <TableHead key={column.id} className="min-w-[120px] max-w-[200px] text-center font-bold" title={fullName}>
                          <div className="flex flex-col items-center justify-center gap-1 py-1">
                            <div className="flex items-start justify-center gap-1">
                              {isSubmitted && reportData?.reportMode !== 'combined' && (
                                <span className="text-emerald-500 font-bold shrink-0 mt-0.5" title="Report Submitted">
                                  ✓
                                </span>
                              )}
                              <span
                                className={cn(
                                  "text-xs leading-tight transition-all duration-200",
                                  !isExpanded && "line-clamp-2"
                                )}
                              >
                                {fullName}
                              </span>
                            </div>
                            {fullName.length > 20 && (
                              <button
                                type="button"
                                onClick={() => toggleColumnExpand(column.id)}
                                className="inline-flex items-center justify-center w-6 h-4 rounded hover:bg-muted text-primary transition-colors mt-0.5"
                                title={isExpanded ? "Show less" : "Show more"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <span className="text-sm leading-none font-bold">...</span>
                                )}
                              </button>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="min-w-37.5 font-bold">Remark</TableHead>
                    <TableHead className="w-24 text-center font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10 + columns.length} className="py-10 text-center text-sm text-muted-foreground">
                        Loading report data...
                      </TableCell>
                    </TableRow>
                  ) : rows.length ? (
                    allRows.map((row) => {
                      const rowType = String(row?.rowType || 'kpi');
                      const isSubTotal = rowType === 'subTotal';
                      const compactPad = isSubTotal ? { paddingTop: '4px', paddingBottom: '4px' } : undefined;

                      return (
                        <TableRow key={row.id} className={getRowClassName(rowType)}>
                          <TableCell style={compactPad} className="text-center text-sm font-medium">
                            {row.no || ''}
                          </TableCell>
                          <TableCell style={compactPad} className={`text-sm ${getRowLabelClassName(rowType)}`}>
                            <div className="flex items-center gap-2">
                              <span>{row.kpi}</span>
                              {isCombinedMode && row.isEvidenceRequired && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider border border-amber-200">
                                  Required
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell style={compactPad} className="text-center text-sm">
                            {row.unit}
                          </TableCell>
                          <TableCell style={compactPad} className="text-center text-sm font-medium">
                            {row.weight}
                          </TableCell>
                          <TableCell style={compactPad} className="text-center text-sm">
                            {row.baseline}
                          </TableCell>
                          <TableCell style={compactPad} className="text-center text-sm">
                            {row.target}
                          </TableCell>
                          {columns.map((column) => {
                            const cellValue = row.values?.[column.id];
                            const isMissingValue =
                              cellValue === null || cellValue === undefined || cellValue === '' || cellValue === '—' || cellValue === 'N/A'
                              || (typeof cellValue === 'object' && cellValue?.value === '—');
                            const showPendingValue = isPendingDisplayCell(cellValue);
                            const displayValue = formatCellValue(cellValue);

                            return (
                              <TableCell
                                key={column.id}
                                style={compactPad}
                                className={`text-center text-sm ${isMissingValue ? 'text-muted-foreground/60' : 'text-foreground font-medium'}`}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  {showPendingValue ? (
                                    <div className="flex flex-col items-center leading-none gap-0.5">
                                      {displayValue === 'Pending' ? (
                                        <span className="text-amber-600 font-bold italic text-xs py-1">Pending</span>
                                      ) : (
                                        <>
                                          {cellValue?.approvedValue !== undefined && cellValue?.approvedValue !== displayValue ? (
                                            <div className="flex items-baseline gap-1">
                                              <span className="text-muted-foreground text-xs" title="Previously approved">{cellValue.approvedValue}</span>
                                              <span className="text-muted-foreground text-xs">(</span>
                                              <span className="font-bold text-sm text-amber-600" title="Total with pending updates">{displayValue}</span>
                                              <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-tight ml-0.5">
                                                Pending
                                              </span>
                                              <span className="text-muted-foreground text-xs">)</span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center gap-0.5">
                                              <span className="font-semibold text-sm">{displayValue}</span>
                                              <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-tight bg-amber-50 px-1 rounded-sm border border-amber-200/50">
                                                Pending
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <span>{displayValue}</span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-xs leading-relaxed italic text-muted-foreground whitespace-pre-wrap">
                            {row.remark}
                          </TableCell>
                          <TableCell style={compactPad} className="text-center border-l border-border/50">
                            {(row.rowType === 'kpi' || !row.rowType) && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(row)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-primary hover:bg-muted transition-colors shadow-sm"
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={20} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <p className="text-base font-medium text-muted-foreground">
                            No report data available for this office.
                          </p>
                          <p className="text-sm text-muted-foreground/60">
                            Ensure KPIs have been allocated and performance has been submitted.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <PerformanceSubmitModal
        open={submissionModalOpen}
        onOpenChange={setSubmissionModalOpen}
        kpi={activeKpi}
        initialValues={submissionInitialValues}
        saving={submitPerformanceMutation.isPending}
        onSubmit={async ({ quarter, result, remark, file }) => {
          if (!activeKpi) return;

          const payload = new FormData();
          payload.append('KPIId', activeKpi.kpiId);
          payload.append('UserKPIId', activeKpi.id);
          payload.append('KPIResult', result);
          payload.append('Quarter', quarter);
          payload.append('Description', remark || activeKpi.name || '');

          if (file) {
            payload.append('EvidenceFile', file);
          }

          submitPerformanceMutation.mutate(payload, {
            onSuccess: () => {
              notify('Performance submitted successfully.', 'success');
              setSubmissionModalOpen(false);
              setActiveKpi(null);
            },
            onError: (err) => {
              notify(err?.response?.data?.message || 'Failed to submit performance.', 'error');
            }
          });
        }}
      />

      <PerformanceDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        kpi={activeKpi}
      />

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirm Report Submission
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground/80">
              Are you sure you want to submit your finalized performance report to{' '}
              <strong>{reportData?.parentRole?.name || 'your parent office'}</strong>?
              <p className="mt-2 text-xs text-muted-foreground">
                Once submitted, your data will become visible in their comparative reports and used for higher-level performance tracking.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submittingReport}
              onClick={async () => {
                // Dynamic Quarter Detection: Check the quarter the user is actually working on
                const qMap = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
                const invQMap = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
                
                let latestIdx = 0;
                rows.forEach(row => {
                  if (!row.isHomeOfficeKpi) return;

                  (row.allQuarterlyResults || row.quarterlyResults || []).forEach(r => {
                    const qStr = (r.Quarter || r.quarter || '').toUpperCase();
                    const qIdx = qMap[qStr] || 0;
                    const val = r.AdjustedResult ?? r.KPIResult ?? r.kpiResult ?? r.value;
                    if (val !== null && val !== undefined && val !== '' && val !== '—' && qIdx > latestIdx) {
                      latestIdx = qIdx;
                    }
                  });
                });

                // Fallback to system current quarter if no data found
                const getSysQuarter = () => {
                  const month = new Date().getMonth() + 1;
                  if (month >= 8 && month <= 10) return 'Q1';
                  if (month >= 11 || month <= 1) return 'Q2';
                  if (month >= 2 && month <= 4) return 'Q3';
                  return 'Q4';
                };
                
                const targetQuarter = latestIdx > 0 ? invQMap[latestIdx] : getSysQuarter();

                const missingPerf = rows.filter(row => {
                  if (!row.isHomeOfficeKpi) return false;

                  const qRes = (row.allQuarterlyResults || row.quarterlyResults || []).find(r => 
                    (r.Quarter || r.quarter || '').toUpperCase() === targetQuarter
                  );
                  
                  const columnId = isCombinedMode ? 'combined' : String(reportData?.scopeRole?.id);
                  const cellValue = row.values?.[columnId];
                  const cellRawValue = cellValue && typeof cellValue === 'object' ? cellValue.value : cellValue;

                  const val = qRes?.AdjustedResult ?? qRes?.KPIResult ?? qRes?.kpiResult ?? qRes?.value;
                  const hasData = (val !== null && val !== undefined && val !== '' && val !== '—') ||
                                  (cellRawValue !== null && cellRawValue !== undefined && cellRawValue !== '' && cellRawValue !== '—');

                  return !hasData;
                });

                const missingEvid = rows.filter(row => {
                  if (!row.isHomeOfficeKpi || !row.isEvidenceRequired) return false;

                  const qRes = (row.allQuarterlyResults || row.quarterlyResults || []).find(r => 
                    (r.Quarter || r.quarter || '').toUpperCase() === targetQuarter
                  );
                  
                  const hasEvidence = qRes?.EvidenceURL || qRes?.evidenceURL || qRes?.evidenceUrl || (row.allEvidenceUrls || []).length > 0;
                  return !hasEvidence;
                });

                if (missingPerf.length > 0 || missingEvid.length > 0) {
                  let msg = `Submission blocked for ${targetQuarter}. `;
                  if (missingPerf.length > 0) msg += `Missing performance for ${missingPerf.length} KPIs. `;
                  if (missingEvid.length > 0) msg += `Missing evidence for ${missingEvid.length} KPIs. `;
                  
                  notify(msg + `Please fill in all metrics for ${targetQuarter} before submitting.`, 'error');
                  setIsSubmitDialogOpen(false);
                  return;
                }

                setIsSubmitDialogOpen(false);
                
                console.log(`[REPORT_SUBMIT] Submitting KPIs for ${targetQuarter}:`, rows.map(r => ({
                  kpi: r.kpi,
                  quarter: targetQuarter,
                  value: (() => {
                    const qRes = (r.quarterlyResults || []).find(qr => 
                      (qr.Quarter || qr.quarter || '').toUpperCase() === targetQuarter
                    );
                    return qRes?.KPIResult ?? qRes?.kpiResult ?? '—';
                  })()
                })));
                submitReportMutation.mutate(
                  {
                    year: reportData?.year,
                  },
                  {
                    onSuccess: (data) => {
                      const parentRoleName = data?.parentRole?.name || reportData?.parentRole?.name || 'parent office';
                      notify(`Report successfully submitted to ${parentRoleName}.`, 'success');
                    },
                    onError: (err) => {
                      notify(err?.response?.data?.message || 'Failed to submit report. Please try again.', 'error');
                    },
                  }
                );
              }}
            >
              {submittingReport ? 'Submitting...' : 'Yes, Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validate & Close Cycle Confirmation Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
              Close Cycle {activeCycleYear}
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="text-sm text-foreground">
                You are about to close the <strong>{activeCycleYear}</strong> cycle and activate <strong>{String(Number(activeCycleYear) + 1)}</strong>.
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">KPI Transition Rules:</p>
                <p>• <strong>Progressive KPIs</strong> — Final performance becomes new baseline &amp; target</p>
                <p>• <strong>Recursive KPIs</strong> — Baseline resets to 0, target resets to default</p>
                <p>• <strong>One-Time KPIs</strong> — Archived, do not carry forward</p>
              </div>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This action cannot be undone. Historical data will be preserved.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)} disabled={closeCycleMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCloseCycle}
              disabled={closeCycleMutation.isPending}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {closeCycleMutation.isPending ? 'Closing Cycle...' : `Confirm & Close ${activeCycleYear}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfficeReport;
