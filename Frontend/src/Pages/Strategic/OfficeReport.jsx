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
  Check 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import PerformanceSubmitModal from '../../Components/KPI/PerformanceSubmitModal';
import PerformanceDetailModal from '../../Components/KPI/PerformanceDetailModal';
import { useSubmitPerformanceMutation, useReportQuery, useSubmitReportMutation } from '../../Hooks/Queries/useKpis';
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
  if (rawValue === null || rawValue === undefined || rawValue === '' || rawValue === '—') {
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
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeKpi, setActiveKpi] = useState(null);
  const [submissionInitialValues, setSubmissionInitialValues] = useState(null);

  const submitPerformanceMutation = useSubmitPerformanceMutation();

  // Queries
  const reportParams = {
    reportType: selectedReportType,
    roleId: selectedScopeRoleId,
    cycleYear: selectedCycleYear,
    reportMode: selectedReportMode,
  };

  const { data: reportData, isLoading: loading, error: queryError } = useReportQuery(reportParams);
  const error = queryError?.response?.data?.message || '';

  // Mutations
  const submitReportMutation = useSubmitReportMutation();
  const submittingReport = submitReportMutation.isPending;

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

  const isMeasurer = reportData?.scopeRoleHasExtraMeasures;
  const isSubordinateOfMeasurer = reportData?.isSubordinateOfMeasurer;

  // Show Original/Derived tabs only if role is a "measurer" (hasExtraMeasures)
  const showReportTypeSelector = isMeasurer;


  // Show Individual/Combined dropdown if role is distributable OR if it has multiple columns (children)
  const showReportModeSelector = reportData?.scopeRoleIsDistributable || (columns.length > 1 && !reportData?.reportMode === 'combined');

  const isDerivedView = selectedReportType === 'derived';
  const isCombinedMode = reportData?.reportMode === 'combined';

  // Calculate if the entire view has pending items
  const hasPendingItems = rows.some((row) =>
    columns.some((col) => row.values?.[col.id]?.approved === false || row.values?.[col.id]?.isApproved === false)
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
                  <option value="">Current Cycle</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}
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
            ) : reportData && !reportData.canSubmit && reportData.parentRole ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                <Check className="h-4 w-4" />
                Report Submitted
              </div>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2 h-9" onClick={() => {}}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card className="border-border shadow-sm">
        <CardHeader className="shrink-0 space-y-2">
          <CardTitle className="text-lg">
            {selectedReportType === 'derived' ? 'Derived KPI Report' : 'Original KPI Report'} for {currentOfficeName}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-hidden rounded-b-lg border-t border-border">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isDerivedView && <TableHead className="w-16 text-center font-bold">No.</TableHead>}
                  <TableHead className="min-w-50 font-bold">KPI</TableHead>
                  <TableHead className="w-24 text-center font-bold">Unit</TableHead>
                  {!isDerivedView && <TableHead className="w-24 text-center font-bold">Weight</TableHead>}
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
                        {!isDerivedView && (
                          <TableCell style={compactPad} className="text-center text-sm font-medium">
                            {row.no || ''}
                          </TableCell>
                        )}
                        <TableCell style={compactPad} className={`text-sm ${isDerivedView ? '' : getRowLabelClassName(rowType)}`}>
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
                        {!isDerivedView && (
                          <TableCell style={compactPad} className="text-center text-sm font-medium">
                            {row.weight}
                          </TableCell>
                        )}
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
                                         <span className="font-semibold text-sm">{displayValue}</span>
                                         <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-tight bg-amber-50 px-1 rounded-sm border border-amber-200/50">
                                           Pending
                                         </span>
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
                              {row.isHomeOfficeKpi && row.isEvidenceRequired && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubmit(row)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors shadow-sm"
                                  title="Add/Update Action"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              )}
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
                          {selectedReportType === 'derived'
                            ? 'No Derived KPIs found for this office.'
                            : selectedReportType === 'original'
                              ? 'No Original KPIs found for this office.'
                              : 'No report data available for this office.'}
                        </p>
                        <p className="text-sm text-muted-foreground/60">
                          {selectedReportType === 'derived'
                            ? 'Try switching to "Original" or "All KPIs" to see standard metrics.'
                            : 'Ensure KPIs have been allocated and performance has been submitted.'}
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
                // New Requirement: Block submission if any KPI that requires evidence has no evidence uploaded
                const missingEvidence = rows.filter(row => {
                  if (!row.isEvidenceRequired) return false;
                  
                  // If it's a KPI that requires evidence, check if any evidence exists globally for this row
                  const hasAggregatedEvidence = row.allEvidenceUrls && row.allEvidenceUrls.length > 0;
                  const hasLocalEvidence = row.quarterlyResults && row.quarterlyResults.some(r => r.evidenceURL || r.EvidenceURL);
                  
                  return !hasAggregatedEvidence && !hasLocalEvidence;
                });

                if (missingEvidence.length > 0) {
                  const names = missingEvidence.map(r => r.kpi).join(', ');
                  notify(`Submission blocked: Evidence is required for ${missingEvidence.length} KPIs: ${names}. Please use the '+' icon to upload evidence first.`, 'error');
                  setIsSubmitDialogOpen(false);
                  return;
                }

                setIsSubmitDialogOpen(false);
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
    </div>
  );
};

export default OfficeReport;
