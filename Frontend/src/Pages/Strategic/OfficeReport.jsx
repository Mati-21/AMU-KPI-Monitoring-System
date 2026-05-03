import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RefreshCw } from 'lucide-react';

import Button from '../../Components/UI/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import { Badge } from '../../Components/UI/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/KPITable/Kpitable';
import { ScrollArea } from '../../Components/UI/scroll-area';
import { api } from '../../api/axios';
import permissionUtils from '../../lib/permissionUtils';
import { useNotification } from '../../Context/NotificationContext';

const REPORT_PERMISSION_KEYS = [
  permissionUtils.permissionKey('view', 'KPI Reporting'),
  permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
  permissionUtils.permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

const formatCellValue = (value) => {
  if (value === 'N/A') return 'N/A';
  if (value === null || value === undefined || value === '' || value === '—') {
    return '-';
  }

  return value;
};

const MAX_COLUMN_NAME_LENGTH = 35;

const truncateColumnName = (name) => {
  const label = String(name || '').trim();
  if (label.length <= MAX_COLUMN_NAME_LENGTH) return label;
  return label.slice(0, MAX_COLUMN_NAME_LENGTH) + '…';
};

const getRowClassName = (rowType) => {
  if (rowType === 'stable') return 'bg-primary/20 font-bold';
  if (rowType === 'theme') return 'bg-primary/12 font-semibold';
  if (rowType === 'subTheme') return 'bg-primary/6 font-medium';
  if (rowType === 'subTotal') return 'report-subtotal-row bg-muted font-semibold border-t border-border';
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedScopeRoleId, setSelectedScopeRoleId] = useState('');
  const [expandedColumns, setExpandedColumns] = useState({});

  const toggleColumnExpand = (columnId) => {
    setExpandedColumns((prev) => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  useEffect(() => {
    let mounted = true;

    const loadReport = async () => {
      if (!canViewReport) {
        setReportData(null);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const params = { t: Date.now() };
        if (selectedScopeRoleId) {
          params.roleId = selectedScopeRoleId;
        }

        const response = await api.get('/user-kpi-results/report', { params });
        if (!mounted) return;

        const nextReportData = response.data?.data || null;
        setReportData(nextReportData);

        if (!selectedScopeRoleId && nextReportData?.availableScopeRoles?.length) {
          setSelectedScopeRoleId(String(nextReportData.scopeRole?.id || nextReportData.availableScopeRoles[0].id));
        }
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load report.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadReport();

    return () => {
      mounted = false;
    };
  }, [canViewReport, refreshToken, selectedScopeRoleId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const triggerRefresh = () => {
      setRefreshToken((previous) => previous + 1);
    };

    const handleStorage = (event) => {
      if (event.key === 'amu:report-data-changed') {
        triggerRefresh();
      }
    };

    window.addEventListener('amu:report-data-changed', triggerRefresh);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', triggerRefresh);

    return () => {
      window.removeEventListener('amu:report-data-changed', triggerRefresh);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', triggerRefresh);
    };
  }, []);

  const columns = reportData?.columns || [];
  const allRows = reportData?.rows || [];
  const rows = allRows.filter((row) => String(row?.rowType || 'kpi') === 'kpi');
  const hasKpiRows = rows.length > 0;
  const currentOfficeName = reportData?.scopeRole?.name || authUser?.roleName || authUser?.role || 'Current Office';
  const scopeRoleOptions = reportData?.availableScopeRoles || [];
  const showScopeSelector = scopeRoleOptions.length > 0;

  return (
    <div className="flex h-full flex-col space-y-4 overflow-hidden p-6">
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report</h1>
          <p className="text-sm text-muted-foreground">KPI report by office scope with child and sub-child performance roll-up</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                -
              </span>
              <span>means no performance submitted yet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                N/A
              </span>
              <span>means not allocated</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
          </div>

          <div className="ml-auto flex items-center gap-2">
            {loading ? <Badge variant="secondary">Loading...</Badge> : null}
            <Button
              type="button"
              size="sm"
              className="flex items-center gap-2"
              disabled={loading || submittingReport || !hasKpiRows}
              onClick={async () => {
                try {
                  setSubmittingReport(true);
                  const response = await api.post('/user-kpi-results/report/submit', {
                    year: reportData?.year,
                  });
                  const parentRoleName = response.data?.data?.parentRole?.name || reportData?.parentRole?.name || 'parent role';
                  notify(`Report submitted to ${parentRoleName}.`, 'success');
                } catch (submitErr) {
                  notify(submitErr?.response?.data?.message || 'Failed to submit report to parent role.', 'error');
                } finally {
                  setSubmittingReport(false);
                }
              }}
            >
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2" onClick={() => setRefreshToken((prev) => prev + 1)}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 space-y-2">
          <CardTitle className="text-lg">Report for {currentOfficeName}</CardTitle>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-auto p-0">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/15">
                  <TableHead className="w-15 text-center font-bold text-foreground border-r border-border">No.</TableHead>
                  <TableHead style={{ textAlign: 'left', paddingLeft: '8px' }} className="min-w-65 font-bold text-foreground border-r border-border">
                    KPI
                  </TableHead>
                  <TableHead className="w-22.5 text-center font-bold text-foreground border-r border-border">Unit</TableHead>
                  <TableHead className="w-22.5 text-center font-bold text-foreground border-r border-border">Weight</TableHead>
                  <TableHead className="w-25 text-center font-bold text-foreground border-r border-border">Baseline</TableHead>
                  <TableHead className="w-22.5 text-center font-bold text-foreground border-r border-border">Target</TableHead>
                  {columns.map((column) => {
                    const fullName = String(column.name || '').trim();
                    const isLong = fullName.length > MAX_COLUMN_NAME_LENGTH;
                    const isExpanded = expandedColumns[column.id];
                    const displayName = isExpanded ? fullName : truncateColumnName(fullName);

                    return (
                      <TableHead
                        key={column.id}
                        className="min-w-35 text-center font-bold text-foreground bg-primary/10 border-r border-border"
                        title={fullName}
                      >
                        <span>{displayName}</span>
                        {isLong ? (
                          <button
                            type="button"
                            onClick={() => toggleColumnExpand(column.id)}
                            className="ml-1 inline-flex text-xs font-normal text-primary hover:underline"
                          >
                            {isExpanded ? 'Less' : 'More'}
                          </button>
                        ) : null}
                      </TableHead>
                    );
                  })}
                  <TableHead className="min-w-45 text-center font-bold text-foreground">Remark</TableHead>
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
                  rows.map((row) => {
                    const rowType = String(row?.rowType || 'kpi');
                    const isSubTotal = rowType === 'subTotal';
                    const compactPad = isSubTotal ? { paddingTop: '2px', paddingBottom: '2px' } : undefined;

                    return (
                      <TableRow key={row.id} className={getRowClassName(rowType)}>
                        <TableCell style={compactPad} className="border-r border-border text-center text-sm font-medium">
                          {row.no || ''}
                        </TableCell>
                        <TableCell
                          style={{ textAlign: 'left', paddingLeft: '8px', ...compactPad }}
                          className={`border-r border-border text-sm ${getRowLabelClassName(rowType)}`}
                        >
                          {row.kpi}
                        </TableCell>
                        <TableCell style={compactPad} className="border-r border-border text-center text-sm">
                          {row.unit}
                        </TableCell>
                        <TableCell style={compactPad} className="border-r border-border text-center text-sm font-medium">
                          {row.weight}
                        </TableCell>
                        <TableCell style={compactPad} className="border-r border-border text-center text-sm">
                          {row.baseline}
                        </TableCell>
                        <TableCell style={compactPad} className="border-r border-border text-center text-sm">
                          {row.target}
                        </TableCell>
                        {columns.map((column) => {
                          const cellValue = row.values?.[column.id];
                          const isMissingValue = cellValue === null || cellValue === undefined || cellValue === '' || cellValue === '—' || cellValue === 'N/A';

                          return (
                            <TableCell
                              key={column.id}
                              style={compactPad}
                              className={`border-r border-border text-center text-sm bg-primary/5 ${isMissingValue ? 'text-slate-500 font-medium' : 'text-foreground'}`}
                            >
                              {formatCellValue(cellValue)}
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
                    <TableCell colSpan={7 + columns.length} className="py-10 text-center text-sm text-muted-foreground">
                      No report data available for this office.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfficeReport;
