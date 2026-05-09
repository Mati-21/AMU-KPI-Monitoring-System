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
  History
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
    const results = { Q1: { val: 0, evidence: null }, Q2: { val: 0, evidence: null }, Q3: { val: 0, evidence: null }, Q4: { val: 0, evidence: null } };
    const rawResults = Array.isArray(kpi.quarterlyResults) ? kpi.quarterlyResults : [];
    rawResults.forEach(r => {
      const q = String(r.quarter || '').toUpperCase();
      if (results.hasOwnProperty(q)) {
        results[q].val = parseFloat(r.result) || 0;
        results[q].evidence = r.evidenceURL || r.EvidenceURL || null;
      }
    });
    return results;
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
      <DialogContent hideClose className="max-w-3xl p-0 overflow-hidden border-0 bg-slate-50 shadow-2xl rounded-3xl max-h-[85vh] flex flex-col">
        {/* Header Section */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold tracking-widest uppercase text-slate-500 border-slate-200">
                  KPI Performance Detail
                </Badge>
                {kpi.isDerived && (
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-0 text-[10px] font-bold uppercase">
                    Derived
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 leading-tight">
                {kpi.name}
              </DialogTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <status.icon className={`h-6 w-6 ${status.color.replace('bg-', 'text-')}`} />
              <span className={`text-xs font-bold uppercase ${status.color.replace('bg-', 'text-')}`}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-grow">
          {/* Progress Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Completion Progress
                  </h3>
                  <span className="text-2xl font-black text-primary">{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-3 bg-slate-100" />
                <div className="flex justify-between mt-3 text-xs text-slate-500 font-medium">
                  <span>Baseline: {formatValue(baseline)}</span>
                  <span>Target: {formatValue(target)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Achieved</p>
                    <p className="text-lg font-bold text-slate-900">{formatValue(totalAchieved)}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Target size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Remaining Gap</p>
                    <p className="text-lg font-bold text-slate-900">{formatValue(Math.max(0, goal - totalAchieved))}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-xs text-slate-500">Unit</span>
                    <span className="text-xs font-bold text-slate-700">{kpi.unit}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-xs text-slate-500">Weight</span>
                    <span className="text-xs font-bold text-slate-700">{kpi.weight}%</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-xs text-slate-500">Evidence</span>
                    <span className={`text-xs font-bold ${kpi.evidenceRequired ? 'text-blue-600' : 'text-slate-400'}`}>
                      {kpi.evidenceRequired ? 'Required' : 'Optional'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quarterly Scorecard */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Quarterly Performance Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                const { val, evidence } = quarterlyResults[q];
                const points = goal > 0 ? Math.min(25, (val / goal) * 100) : 0;
                const isSubmitted = val > 0 || (Array.isArray(kpi.quarterlyResults) && kpi.quarterlyResults.some(r => r.quarter === q));

                return (
                  <div key={q} className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${isSubmitted ? 'border-primary/20 bg-primary/[0.02]' : 'border-slate-200 grayscale opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400">{q}</span>
                      {isSubmitted ? (
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      ) : (
                        <Clock className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-slate-900">{formatValue(val)}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Points</span>
                        <span className="text-[10px] font-bold text-primary">{points.toFixed(1)}/25</span>
                      </div>
                    </div>
                    {evidence && (
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/${evidence}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-1.5 text-[9px] font-bold text-blue-600 transition hover:bg-blue-100"
                      >
                        <FileText size={10} />
                        VIEW EVIDENCE
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission History Timeline */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <History size={14} />
              Submission History
            </h3>

            {Array.isArray(kpi.quarterlyResults) && kpi.quarterlyResults.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-slate-200 pl-4">
                {[...kpi.quarterlyResults].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((entry, index) => (
                  <div key={entry.id || index} className="relative pl-8">
                    <div className="absolute left-[-21px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-50 bg-primary text-white shadow-sm">
                      <CalendarDays size={10} />
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                          {entry.quarter}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mb-2">
                        Result: <span className="text-primary">{formatValue(entry.result)}</span>
                      </p>
                      {entry.remark && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg flex gap-2">
                          <FileText size={12} className="shrink-0 mt-0.5" />
                          {entry.remark}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 italic">
                No submissions recorded yet.
              </div>
            )}
          </div>

          {/* Remark / Info Section */}
          {kpi.remark && kpi.remark !== '—' && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase">
                <AlertCircle size={14} />
                Latest Remark
              </div>
              <p className="text-sm text-amber-900 leading-relaxed italic">
                "{kpi.remark}"
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium italic">
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
