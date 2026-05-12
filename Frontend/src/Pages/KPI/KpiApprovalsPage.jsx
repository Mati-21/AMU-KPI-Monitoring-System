import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/axios';
import { useSelector } from 'react-redux';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock3, Eye, FileText, Monitor, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';

import Button from '../../Components/UI/Button';
import { Badge } from '../../Components/UI/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../Components/UI/dialog';
import permissionUtils from '../../lib/permissionUtils';
import { useNotification } from '../../Context/NotificationContext';

const statusMeta = {
  pending: {
    label: 'Pending Review',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock3,
  },
  approved: {
    label: 'Approved',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  adjusted: {
    label: 'Adjusted & Approved',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: PencilLine,
  },
};

const tabs = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'adjusted', label: 'Adjusted' },
  { key: 'all', label: 'All' },
];

const formatPercent = (value) => `${Number(value || 0).toLocaleString()}%`;

const emitReportDataChanged = () => {
  const timestamp = String(Date.now());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amu:report-data-changed', { detail: { timestamp } }));
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('amu:report-data-changed', timestamp);
  }
};

const KpiApprovalsPage = () => {
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = authUser?.permissions || [];
  const canApprove = permissionUtils.hasPermission(userPermissions, permissionUtils.permissionKey('create', 'KPI Approvals'));
  const [activeTab, setActiveTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewingEvidenceFor, setViewingEvidenceFor] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleRefresh = () => {
      setRefreshToken((previous) => previous + 1);
    };

    const handleStorage = (event) => {
      if (event.key === 'amu:report-data-changed') {
        handleRefresh();
      }
    };

    window.addEventListener('amu:report-data-changed', handleRefresh);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('amu:report-data-changed', handleRefresh);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/user-kpi-results/approvals');
        setItems(response.data?.data || []);
      } catch (err) {
        console.error('Fetch approvals error:', err);
        setError('Failed to load KPI approvals.');
        notify('Failed to load KPI approvals.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [notify, refreshToken]);

  const handleWatch = (file) => {
    if (file.url) {
      const fullUrl = file.url.startsWith('http') ? file.url : `http://localhost:5000${file.url}`;
      window.open(fullUrl, '_blank');
    } else {
      notify(`Previewing ${file.name}...`, 'info');
    }
  };

  const visibleItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => item.status === activeTab);
  }, [activeTab, items]);

  const counts = useMemo(() => {
    const initial = { total: 0, pending: 0, approved: 0, adjusted: 0, evidence: 0 };
    if (!Array.isArray(items)) return initial;

    return items.reduce((accumulator, item) => {
      const status = item?.status;
      accumulator.total += 1;
      if (status && Object.prototype.hasOwnProperty.call(accumulator, status)) {
        accumulator[status] += 1;
      }
      accumulator.evidence += item.evidence?.length || 0;
      return accumulator;
    }, initial);
  }, [items]);

  const handleApprove = async (approval) => {
    if (!canApprove) {
      notify('You do not have permission to approve KPI submissions.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to approve the KPI submission for "${approval.title}" reported by ${approval.submitter}?`
    );
    if (!confirmed) return;

    try {
      await api.patch(`/user-kpi-results/${approval.id}/approve`);
      setItems((current) => current.map((item) => (item.id === approval.id ? { ...item, status: 'approved' } : item)));
      emitReportDataChanged();
      notify('KPI submission approved successfully.', 'success');
    } catch (err) {
      notify('Failed to approve KPI submission.', 'error');
    }
  };

  const handleAdjustAndApprove = async (approval) => {
    if (!canApprove) {
      notify('You do not have permission to adjust KPI submissions.', 'error');
      return;
    }

    const nextValue = window.prompt(`Adjust reported value for ${approval.title}`, String(approval.reported));
    if (nextValue === null) return;

    const parsedValue = Number(nextValue);
    if (!Number.isFinite(parsedValue)) {
      notify('Enter a valid adjusted value.', 'warning');
      return;
    }

    try {
      await api.patch(`/user-kpi-results/${approval.id}/adjust`, { adjustedValue: parsedValue });
      setItems((current) => current.map((item) => (item.id === approval.id ? { ...item, status: 'adjusted', adjustedReported: parsedValue } : item)));
      emitReportDataChanged();
      notify('KPI submission adjusted and approved.', 'success');
    } catch (err) {
      notify('Failed to adjust KPI submission.', 'error');
    }
  };

  return (
    <div className="min-h-full bg-linear-to-br from-slate-50 via-white to-blue-50/60 px-5 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              KPI Approvals
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">KPI Approvals</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Review evidence-based submissions from child units. Approve directly or adjust the reported value before final approval.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2 bg-white/90">
              <Clock3 className="h-4 w-4" />
              Audit Trail
            </Button>
            <Button variant="outline" className="gap-2 bg-white/90">
              <ArrowDownToLine className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Pending Review', value: counts?.pending ?? 0, icon: Clock3, tone: 'bg-amber-50 text-amber-600' },
            { label: 'Approved', value: counts?.approved ?? 0, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
            { label: 'Adjusted & Approved', value: counts?.adjusted ?? 0, icon: PencilLine, tone: 'bg-sky-50 text-sky-600' },
            { label: 'Evidence Files', value: counts?.evidence ?? 0, icon: FileText, tone: 'bg-blue-50 text-blue-600' },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold leading-none text-slate-900">{card.value}</p>
                    <p className="text-sm text-slate-500">{card.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">
                ({tab.key === 'all' ? items.length : items.filter((item) => item.status === tab.key).length})
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-slate-500">Loading pending approvals...</p>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="mt-4 text-sm font-medium text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-4 bg-white" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-slate-300" />
              <p className="mt-4 text-sm text-slate-500">No {activeTab !== 'all' ? activeTab : ''} submissions found.</p>
            </div>
          ) : (
            visibleItems.map((approval) => {
              const status = statusMeta[approval.status] || statusMeta.pending;
              const StatusIcon = status.icon;

              return (
                <section key={approval.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_300px]">
                    <div className="space-y-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-slate-500">{approval.category}</p>
                          <h2 className="text-xl font-bold text-slate-900">{approval.title}</h2>
                        </div>
                        <Badge variant="outline" className={`gap-1.5 border ${status.badge}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{approval.submitter}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-slate-400" />
                          {approval.unit}
                        </p>
                        <p className="flex items-center gap-2 text-slate-500">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          {approval.period} · submitted {approval.submittedAt}
                        </p>
                      </div>
                    </div>

                    <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reported Performance</p>
                      <div className="mt-4 grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Baseline</p>
                          <p className="text-lg font-bold text-slate-900">{formatPercent(approval.baseline)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Target</p>
                          <p className="text-lg font-bold text-slate-900">{formatPercent(approval.target)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Reported</p>
                          <p className="text-lg font-bold text-blue-600">{formatPercent(approval.adjustedReported ?? approval.reported)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Evidence</p>
                          <p className={`text-sm font-bold ${approval.evidenceRequired ? 'text-amber-600' : 'text-slate-400'}`}>
                            {approval.evidenceRequired ? 'Required' : 'Not Required'}
                          </p>
                        </div>
                      </div>

                      <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">“{approval.note}”</p>

                      {approval.evidence.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Attached Evidence</p>
                            {approval.evidence.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setViewingEvidenceFor(approval)}
                                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View All ({approval.evidence.length})
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {approval.evidence.slice(0, 2).map((file) => (
                              <div
                                key={file.name}
                                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                                  <div className="truncate">
                                    <p className="truncate text-xs font-medium text-slate-900" title={file.name}>
                                      {file.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleWatch(file)}
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-blue-600"
                                  >
                                    <Monitor className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-center space-y-4 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Action Required</p>

                      {approval.status === 'pending' ? (
                        <div className="space-y-2">
                          <Button className="w-full gap-2" onClick={() => handleApprove(approval)} disabled={!canApprove}>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full gap-2 bg-white"
                            onClick={() => handleAdjustAndApprove(approval)}
                            disabled={!canApprove}
                          >
                            <PencilLine className="h-4 w-4" />
                            Adjust &amp; Approve
                          </Button>
                          {!canApprove ? <p className="text-xs text-slate-500">Approvals require the create permission for KPI Approvals.</p> : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          Finalized — included in aggregated reports.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!viewingEvidenceFor} onOpenChange={(open) => !open && setViewingEvidenceFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Evidence Documents
            </DialogTitle>
            <DialogDescription>
              Viewing evidence for {viewingEvidenceFor?.title} submitted by {viewingEvidenceFor?.submitter}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {viewingEvidenceFor?.evidence.map((file) => (
              <div
                key={file.name}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="max-w-37.5 truncate">
                    <p className="truncate text-sm font-semibold text-slate-900" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleWatch(file)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                    title="Watch"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
                    title="Download"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KpiApprovalsPage;
