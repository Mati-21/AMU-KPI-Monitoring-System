import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/axios';
import { useSelector } from 'react-redux';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock3, Eye, FileText, Monitor, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';

import Button from '../../Components/UI/Button';
import { Badge } from '../../Components/UI/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../Components/UI/dialog';
import permissionUtils from '../../lib/permissionUtils';
import { useNotification } from '../../Context/NotificationContext';
import { useKpiApprovalsQuery, useApproveKpiMutation, useAdjustKpiMutation } from '../../Hooks/Queries/useKpis';

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

const formatValue = (value) => `${Number(value || 0).toLocaleString()}`;

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
  const [viewingEvidenceFor, setViewingEvidenceFor] = useState(null);
  const [actionModal, setActionModal] = useState({
    open: false,
    type: 'approve', // 'approve' | 'adjust'
    approval: null,
    adjustedValue: '',
    remark: '',
  });

  // Queries
  const { data: items = [], isLoading: loading, error: queryError } = useKpiApprovalsQuery();
  const error = queryError ? 'Failed to load KPI approvals.' : null;

  // Mutations
  const approveKpiMutation = useApproveKpiMutation();
  const adjustKpiMutation = useAdjustKpiMutation();

  const handleWatch = (file) => {
    if (file.url) {
      const fullUrl = file.url.startsWith('http') ? file.url : `http://localhost:6000${file.url}`;
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

  const handleApprove = (approval) => {
    if (!canApprove) {
      notify('You do not have permission to approve KPI submissions.', 'error');
      return;
    }
    setActionModal({
      open: true,
      type: 'approve',
      approval,
      adjustedValue: '',
      remark: '',
    });
  };

  const handleAdjustAndApprove = (approval) => {
    if (!canApprove) {
      notify('You do not have permission to adjust KPI submissions.', 'error');
      return;
    }
    setActionModal({
      open: true,
      type: 'adjust',
      approval,
      adjustedValue: String(approval.adjustedReported ?? approval.reported),
      remark: '',
    });
  };

  const handleConfirmAction = async () => {
    const { type, approval, adjustedValue, remark } = actionModal;
    if (!approval) return;

    if (type === 'approve') {
      approveKpiMutation.mutate(
        { id: approval.id, remark },
        {
          onSuccess: () => {
            emitReportDataChanged();
            notify('KPI submission approved successfully.', 'success');
            setActionModal((prev) => ({ ...prev, open: false }));
          },
          onError: () => {
            notify('Failed to approve KPI submission.', 'error');
          },
        }
      );
    } else {
      const parsedValue = Number(adjustedValue);
      if (adjustedValue === '' || !Number.isFinite(parsedValue)) {
        notify('Enter a valid adjusted value.', 'warning');
        return;
      }

      adjustKpiMutation.mutate(
        { id: approval.id, adjustedValue: parsedValue, remark },
        {
          onSuccess: () => {
            emitReportDataChanged();
            notify('KPI submission adjusted and approved.', 'success');
            setActionModal((prev) => ({ ...prev, open: false }));
          },
          onError: () => {
            notify('Failed to adjust KPI submission.', 'error');
          },
        }
      );
    }
  };

  return (
    <div className="min-h-full bg-background px-5 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              KPI Approvals
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">KPI Approvals</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Review evidence-based submissions from child units. Approve directly or adjust the reported value before final approval.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2">
              <Clock3 className="h-4 w-4" />
              Audit Trail
            </Button>
            <Button variant="outline" className="gap-2">
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
              <div key={card.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold leading-none text-foreground">{card.value}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
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
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading pending approvals...</p>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-red-200 bg-red-50 px-6 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="mt-4 text-sm font-medium text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-4 bg-card" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">No {activeTab !== 'all' ? activeTab : ''} submissions found.</p>
            </div>
          ) : (
            visibleItems.map((approval) => {
              const status = statusMeta[approval.status] || statusMeta.pending;
              const StatusIcon = status.icon;

              return (
                <section key={approval.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_300px]">
                    <div className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">{approval.category}</p>
                          <h2 className="text-xl font-bold text-foreground">{approval.title}</h2>
                        </div>
                        <Badge variant="outline" className={`gap-1.5 border ${status.badge}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-muted-foreground/60" />
                          <span className="font-medium text-foreground">{approval.submitter}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground/60" />
                          {approval.unit}
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground/80">
                          <Clock3 className="h-4 w-4 text-muted-foreground/60" />
                          {approval.period} · submitted {approval.submittedAt}
                        </p>
                      </div>
                    </div>

                    <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">Reported Performance</p>
                      <div className="mt-4 grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Baseline</p>
                          <p className="text-lg font-bold text-foreground">{formatValue(approval.baseline)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Target</p>
                          <p className="text-lg font-bold text-foreground">{formatValue(approval.target)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Reported</p>
                          <p className="text-lg font-bold text-primary">{formatValue(approval.adjustedReported ?? approval.reported)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Evidence</p>
                          <p className={`text-sm font-bold ${approval.evidenceRequired ? 'text-amber-600' : 'text-muted-foreground/40'}`}>
                            {approval.evidenceRequired ? 'Required' : 'Not Required'}
                          </p>
                        </div>
                      </div>

                      <p className="mt-5 rounded-2xl bg-muted/30 px-4 py-3 text-sm text-muted-foreground">“{approval.note}”</p>

                      {approval.evidence.length > 0 && (
                        <div className="mt-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Attached Evidence</p>
                            {approval.evidence.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setViewingEvidenceFor(approval)}
                                className="flex items-center gap-1.5 text-xs font-medium text-primary transition hover:text-primary/80"
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
                                className="group flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                                  <div className="truncate">
                                    <p className="truncate text-xs font-medium text-foreground" title={file.name}>
                                      {file.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleWatch(file)}
                                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-card hover:text-primary"
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
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">Action Required</p>

                      {approval.status === 'pending' ? (
                        <div className="space-y-2">
                          <Button className="w-full gap-2" onClick={() => handleApprove(approval)} disabled={!canApprove}>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full gap-2 bg-card"
                            onClick={() => handleAdjustAndApprove(approval)}
                            disabled={!canApprove}
                          >
                            <PencilLine className="h-4 w-4" />
                            Adjust &amp; Approve
                          </Button>
                          {!canApprove ? (
                            <p className="text-xs text-muted-foreground">Approvals require the create permission for KPI Approvals.</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
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
                className="group flex items-center justify-between rounded-2xl border border-border bg-muted/50 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="max-w-37.5 truncate">
                    <p className="truncate text-sm font-semibold text-foreground" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleWatch(file)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                    title="Watch"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-foreground hover:text-foreground"
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

      {/* Action Modal (Approve / Adjust) */}
      <Dialog open={actionModal.open} onOpenChange={(open) => setActionModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionModal.type === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Approve Submission
                </>
              ) : (
                <>
                  <PencilLine className="h-5 w-5 text-sky-600" />
                  Adjust & Approve
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Reviewing submission for <span className="font-semibold text-foreground">{actionModal.approval?.title}</span> by{' '}
              {actionModal.approval?.submitter}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionModal.type === 'adjust' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Adjusted Performance Value</label>
                <input
                  type="number"
                  value={actionModal.adjustedValue}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, adjustedValue: e.target.value }))}
                  placeholder="Enter corrected value"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Approver's Remark</label>
              <textarea
                value={actionModal.remark}
                onChange={(e) => setActionModal((prev) => ({ ...prev, remark: e.target.value }))}
                placeholder="Add a note or feedback (optional)"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={approveKpiMutation.isPending || adjustKpiMutation.isPending}
              className={actionModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'}
            >
              {approveKpiMutation.isPending || adjustKpiMutation.isPending ? 'Processing...' : 'Confirm Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KpiApprovalsPage;
