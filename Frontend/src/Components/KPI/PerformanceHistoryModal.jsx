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
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border border-border/60 bg-background p-0 text-foreground shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </span>
              Performance History
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              View all submitted results and evidence for <span className="font-semibold text-foreground/80">{kpi?.name}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-6">
            {/* KPI Summary Card */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Target size={12} />
                  Target
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">{formatValue(kpi?.target)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Target size={12} className="rotate-180" />
                  Baseline
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">{formatValue(kpi?.baseline)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Info size={12} />
                  Unit
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">{kpi?.unit || '—'}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <History size={12} />
                  Entries
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">{quarterlyResults.length}</div>
              </div>
            </div>

            {/* Entries List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Submission Timeline</h3>
              
              {quarterlyResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 py-12 text-center">
                  <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
                    <History size={24} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No performance entries found for this cycle.</p>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-border">
                  {quarterlyResults.map((entry, index) => (
                    <div key={entry.id || index} className="relative pl-12">
                      <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20">
                        <CalendarDays size={16} />
                      </div>
                      
                      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <span className="inline-flex rounded-lg bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                              {entry.quarter}
                            </span>
                            <h4 className="mt-1 text-sm font-bold text-foreground">
                              Result: <span className="text-primary">{formatValue(entry.result)}</span>
                            </h4>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground">Submitted on</div>
                            <div className="text-[11px] font-medium text-muted-foreground/80">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        {entry.remark && (
                          <div className="mt-3 flex gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                            <FileText size={14} className="mt-0.5 shrink-0 text-muted-foreground/50" />
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

        <div className="shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-6 font-semibold"
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
