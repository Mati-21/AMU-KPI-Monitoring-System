import React, { useMemo } from 'react';
import {
  BarChart3,
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  ChevronRight,
  FileText,
  Info,
  CalendarDays,
  History,
  ShieldCheck,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../UI/dialog';
import { Progress } from '../UI/progress';
import { Badge } from '../UI/Badge';
import Button from '../UI/Button';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const numeric = Number(value);
  return isNaN(numeric) ? '0' : numeric.toLocaleString();
};

const PerformanceDetailModal = ({ open, onOpenChange, kpi }) => {
  if (!kpi) return null;

  const target = parseFloat(kpi.target) || 0;
  const baseline = parseFloat(kpi.baseline) || 0;
  const goal = Math.max(0, target - baseline);

  const quarterlyResults = useMemo(() => {
    const results = {
      Q1: { val: 0, evidence: null },
      Q2: { val: 0, evidence: null },
      Q3: { val: 0, evidence: null },
      Q4: { val: 0, evidence: null },
    };
    const rawResults = Array.isArray(kpi.quarterlyResults) ? kpi.quarterlyResults : [];
    rawResults.forEach((r) => {
      const q = String(r.quarter || '').toUpperCase();
      if (results.hasOwnProperty(q)) {
        results[q].val = parseFloat(r.result) || 0;
        results[q].evidence = r.evidenceURL || r.EvidenceURL || null;
      }
    });
    return results;
  }, [kpi]);

  const allEvidence = useMemo(() => {
    const rawResults = Array.isArray(kpi.quarterlyResults) ? kpi.quarterlyResults : [];
    const evidenceItems = rawResults
      .filter((r) => r.evidenceURL || r.EvidenceURL)
      .map((r) => ({
        url: r.evidenceURL || r.EvidenceURL,
        quarter: r.quarter || 'Submitted',
        result: r.result || r.KPIResult || r.AdjustedResult,
        date: r.createdAt || r.CreatedAt,
      }));

    // Add any aggregated evidence URLs that might not be in the direct quarterlyResults
    const existingUrls = new Set(evidenceItems.map((item) => item.url));
    if (Array.isArray(kpi.allEvidenceUrls)) {
      kpi.allEvidenceUrls.forEach((url) => {
        if (!existingUrls.has(url)) {
          evidenceItems.push({
            url,
            quarter: 'Evidence',
            result: null,
            date: null,
          });
        }
      });
    }

    return evidenceItems;
  }, [kpi]);

  const totalAchieved = Object.values(quarterlyResults).reduce((sum, v) => sum + v.val, 0);
  const completionPercentage = goal > 0 ? Math.min(100, Math.round((totalAchieved / goal) * 100)) : 0;

  const getStatus = () => {
    if (completionPercentage >= 100) return { label: 'Achieved', color: 'bg-green-500', icon: CheckCircle2 };
    if (completionPercentage > 0) return { label: 'In Progress', color: 'bg-blue-500', icon: Activity };
    return { label: 'Not Started', color: 'bg-slate-400', icon: Clock };
  };

  const status = getStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-3xl p-0 overflow-hidden border border-border/60 bg-background shadow-2xl rounded-3xl max-h-[85vh] flex flex-col"
      >
        {/* Header Section */}
        <div className="bg-card border-b border-border px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-border">
                  KPI Performance Detail
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground leading-tight">{kpi.name}</DialogTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <status.icon className={`h-6 w-6 ${status.color.replace('bg-', 'text-')}`} />
              <span className={`text-xs font-bold uppercase ${status.color.replace('bg-', 'text-')}`}>{status.label}</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-grow">
          {/* Progress Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Completion Progress
                  </h3>
                  <span className="text-2xl font-black text-primary">{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-3 bg-muted" />
                <div className="flex justify-between mt-3 text-xs text-muted-foreground font-medium">
                  <span>Baseline: {formatValue(baseline)}</span>
                  <span>Target: {formatValue(target)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Achieved</p>
                    <p className="text-lg font-bold text-foreground">{formatValue(totalAchieved)}</p>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Target size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Remaining Gap</p>
                    <p className="text-lg font-bold text-foreground">{formatValue(Math.max(0, goal - totalAchieved))}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground/80 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-xs text-muted-foreground">Unit</span>
                    <span className="text-xs font-bold text-foreground/80">{kpi.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-xs text-muted-foreground">Weight</span>
                    <span className="text-xs font-bold text-foreground/80">{kpi.weight}%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-xs text-muted-foreground">Evidence</span>
                    <span className={`text-xs font-bold ${kpi.evidenceRequired ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {kpi.evidenceRequired ? 'Required' : 'Optional'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded KPI Evidence */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Uploaded KPI Evidence</h3>
            {allEvidence.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {allEvidence.map((ev, idx) => (
                  <a
                    key={idx}
                    href={ev.url?.startsWith('http') ? ev.url : `${import.meta.env.VITE_API_URL || 'http://localhost:6000'}/uploads/${ev.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-primary/30 hover:bg-primary/[0.02] transition-all min-w-[180px]"
                  >
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">{ev.quarter} Evidence</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Result: {formatValue(ev.result)}</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground italic text-xs">
                No evidence files uploaded for this KPI.
              </div>
            )}
          </div>

          {/* Submission History Timeline */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
              <History size={14} />
              Submission History
            </h3>

            {Array.isArray(kpi.quarterlyResults) && kpi.quarterlyResults.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-border pl-4">
                {[...kpi.quarterlyResults]
                  .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                  .map((entry, index) => (
                    <div key={entry.id || index} className="relative pl-8">
                      <div className="absolute left-[-21px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
                        <CalendarDays size={10} />
                      </div>
                      <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                {entry.quarter}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-foreground">
                                Result: <span className="text-primary">{formatValue(entry.result)}</span>
                              </p>
                              {entry.status === 'adjusted' && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 bg-sky-500/10 text-sky-500 border-sky-500/20 uppercase font-bold px-1.5 py-0"
                                >
                                  Parent Adjusted
                                </Badge>
                              )}
                            </div>
                            {entry.remark && entry.remark !== entry.performanceTitle && (
                              <div className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-lg flex gap-2 italic">
                                <Info size={12} className="shrink-0 mt-0.5" />
                                Submitter: {entry.remark}
                              </div>
                            )}
                          </div>

                          {(entry.approverRemark || (entry.remark && entry.remark !== entry.performanceTitle)) && (
                            <div className="flex-1 md:border-l md:pl-4 space-y-2 border-t md:border-t-0 pt-2 md:pt-0 border-border">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Review Remarks</p>
                              {entry.approverRemark ? (
                                <div className="text-[11px] text-emerald-600 bg-emerald-500/10 p-2 rounded-lg flex gap-2">
                                  <ShieldCheck size={12} className="shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Approver: </span>
                                    {entry.approverRemark}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground italic p-2">Pending final review remark</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground italic">No submissions recorded yet.</div>
            )}
          </div>

          {/* Remark / Info Section */}
          {kpi.remark && kpi.remark !== '—' && (
            <div className="bg-amber-500/10 rounded-2xl border border-amber-500/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase">
                <AlertCircle size={14} />
                Latest Remark
              </div>
              <p className="text-sm text-amber-600/90 leading-relaxed italic">"{kpi.remark}"</p>
            </div>
          )}
        </div>

        <div className="bg-card border-t border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium italic">
            <Info size={12} />
            Scores are calculated based on the 25-point quarterly incremental model.
          </div>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl px-8">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceDetailModal;
