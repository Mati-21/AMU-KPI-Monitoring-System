import React from 'react';
import { History, Target, CalendarDays, FileText, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../UI/dialog';
import Button from '../UI/Button';

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
};

const PerformanceHistoryModal = ({ open, onOpenChange, kpi }) => {
  const quarterlyResults = Array.isArray(kpi?.quarterlyResults) ? kpi.quarterlyResults : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border-0 bg-slate-50 p-0 text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-600">
                <History className="h-5 w-5" />
              </span>
              Performance History
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              View all submitted results and evidence for <span className="font-semibold text-slate-700">{kpi?.name}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-6">
            {/* KPI Summary Card */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Target size={12} />
                  Target
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{formatValue(kpi?.target)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Target size={12} className="rotate-180" />
                  Baseline
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{formatValue(kpi?.baseline)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Info size={12} />
                  Unit
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{kpi?.unit || '—'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <History size={12} />
                  Entries
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{quarterlyResults.length}</div>
              </div>
            </div>

            {/* Entries List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Submission Timeline</h3>
              
              {quarterlyResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-100/50 py-12 text-center">
                  <div className="mb-3 rounded-full bg-slate-200 p-3 text-slate-400">
                    <History size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No performance entries found for this cycle.</p>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-slate-200">
                  {quarterlyResults.map((entry, index) => (
                    <div key={entry.id || index} className="relative pl-12">
                      <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-slate-50 bg-purple-600 text-white shadow-sm ring-1 ring-purple-100">
                        <CalendarDays size={16} />
                      </div>
                      
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">
                              {entry.quarter}
                            </span>
                            <h4 className="mt-1 text-sm font-bold text-slate-900">
                              Result: <span className="text-purple-600">{formatValue(entry.result)}</span>
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400">Submitted on</div>
                            <div className="text-[11px] font-medium text-slate-600">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        {entry.remark && (
                          <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                            <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            {entry.remark}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-200 px-6 font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Close History
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceHistoryModal;
