import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RefreshCw, Clock3 } from 'lucide-react';

import Button from '../../Components/UI/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import { Badge } from '../../Components/UI/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/UI/Table';
import { ScrollArea } from '../../Components/UI/scroll-area';
import { api } from '../../api/axios';
import permissionUtils from '../../lib/permissionUtils';
import { useNotification } from '../../Context/NotificationContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../Components/UI/dialog';
import { AlertCircle } from 'lucide-react';
import { useReportQuery, useSubmitReportMutation } from '../../Hooks/Queries/useKpis';

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
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const canViewReport = permissionUtils.hasPermission(userPermissions, REPORT_PERMISSION_KEYS);

  const [selectedScopeRoleId, setSelectedScopeRoleId] = useState('');
  const [expandedColumns, setExpandedColumns] = useState({});
  const [selectedReportType, setSelectedReportType] = useState('all');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedCycleYear, setSelectedCycleYear] = useState('');
  const [selectedReportMode, setSelectedReportMode] = useState('individual');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);

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

  const hasOriginal = reportData?.hasOriginal ?? false;
  const hasDerived = reportData?.hasDerived ?? false;

  // Show Original/Derived dropdown if role has extra measures OR if both types exist in data
  const showReportTypeSelector = reportData?.scopeRoleHasExtraMeasures || (hasOriginal && hasDerived);

  // Show Individual/Combined dropdown if role is distributable OR if it has multiple columns (children)
  const showReportModeSelector = reportData?.scopeRoleIsDistributable || (columns.length > 1 && !reportData?.reportMode === 'combined');

  const isDerivedView = selectedReportType === 'derived';

  // Calculate if the entire view has pending items
  const hasPendingItems = rows.some((row) =>
    columns.some((col) => row.values?.[col.id]?.approved === false || row.values?.[col.id]?.isApproved === false)
  );

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

            {showReportTypeSelector ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Type</span>
                <select
                  value={selectedReportType}
                  onChange={(event) => setSelectedReportType(event.target.value)}
                  className="min-w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none"
                >
                  <option value="all">All KPIs</option>
                  <option value="original">Original</option>
                  <option value="derived">Derived</option>
                </select>
              </div>
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
            <Button
              type="button"
              size="sm"
              className="flex items-center gap-2"
              disabled={submittingReport}
              onClick={() => setIsSubmitDialogOpen(true)}
            >
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2" onClick={() => {}}>
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
            {isDerivedView ? 'Derived KPI Report' : 'Report'} for {currentOfficeName}
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
                      <TableHead key={column.id} className="min-w-30 text-center font-bold" title={fullName}>
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <div className="flex items-center justify-center gap-1">
                            {isSubmitted && !reportData?.reportMode === 'combined' && (
                              <span className="text-emerald-500 font-bold" title="Report Submitted">
                                ✓{' '}
                              </span>
                            )}
                            <span>{displayName}</span>
                          </div>
                          {isLong ? (
                            <button
                              type="button"
                              onClick={() => toggleColumnExpand(column.id)}
                              className="text-[10px] font-normal text-primary hover:underline"
                            >
                              [{isExpanded ? 'Less' : 'More'}]
                            </button>
                          ) : null}
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="min-w-37.5 font-bold">Remark</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7 + columns.length} className="py-10 text-center text-sm text-muted-foreground">
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
                          {row.kpi}
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
                          // When some quarters approved + some pending: value = approved total, pendingTotal = full total
                          const hasMixedApproval = showPendingValue && cellValue?.value && cellValue.value !== '-' && cellValue.value !== '—';
                          const displayValue = formatCellValue(cellValue);

                          return (
                            <TableCell
                              key={column.id}
                              style={compactPad}
                              className={`text-center text-sm ${isMissingValue ? 'text-muted-foreground/60' : 'text-foreground font-medium'}`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                {hasMixedApproval ? (
                                  // Has some approved quarters AND some pending (parent report view)
                                  <span>
                                    {displayValue}
                                    <span className="text-amber-500 text-xs ml-1">
                                      ({cellValue?.pendingTotal ?? displayValue} Pending)
                                    </span>
                                  </span>
                                ) : showPendingValue ? (
                                  // All pending OR own-report pending (show value with tag)
                                  <span>
                                    {displayValue !== '-' ? displayValue : ''}
                                    <span className="text-amber-500 text-xs ml-1">(Pending)</span>
                                  </span>
                                ) : (
                                  <span>{displayValue}</span>
                                )}
                                {showPendingValue && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-200 bg-amber-50 text-amber-600 font-normal">
                                    Awaiting Approval
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell style={compactPad} className="text-sm text-muted-foreground">
                          {row.remark}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7 + columns.length} className="py-20 text-center">
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
