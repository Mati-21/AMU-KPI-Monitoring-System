import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileUp, Target } from 'lucide-react';
import Button from '../UI/Button';
import { Input } from '../UI/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../UI/dialog';
import { useNotification } from '../../Context/NotificationContext';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const getCurrentQuarter = (date = new Date()) => {
  const month = date.getMonth() + 1;

  if (month >= 8 && month <= 10) return 'Q1';
  if (month >= 11 || month <= 1) return 'Q2';
  if (month >= 2 && month <= 4) return 'Q3';
  return 'Q4';
};

const getFirstEmptyQuarter = (quarterlyResults = []) => {
  if (!Array.isArray(quarterlyResults)) return 'Q1';
  const filledQuarters = new Set(quarterlyResults.map(r => String(r.quarter || '').toUpperCase()));
  for (const q of QUARTERS) {
    if (!filledQuarters.has(q.toUpperCase())) return q;
  }
  return 'Q1';
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric
        .toFixed(2)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*?)0+$/, '$1');
};

const createInitialForm = (quarter = 'Q1', initialValues = {}) => ({
  quarter: initialValues.quarter || quarter,
  result: initialValues.result || '',
  remark: initialValues.remark || '',
  file: null,
});

const PerformanceSubmitModal = ({ open, onOpenChange, kpi, initialValues, onSubmit, saving }) => {
  const { notify } = useNotification();
  const [form, setForm] = useState(() => createInitialForm());

  useEffect(() => {
    if (!open) return;
    
    // Default to first empty quarter if not editing specific entry
    const defaultQuarter = getFirstEmptyQuarter(kpi?.quarterlyResults);
    
    setForm(
      createInitialForm(initialValues?.quarter || defaultQuarter, {
        quarter: initialValues?.quarter,
        result: initialValues?.result || '',
        remark: initialValues?.remark || '',
      })
    );
  }, [open, initialValues, kpi]);

  // Reactive prefilling when quarter changes
  useEffect(() => {
    if (!open || !kpi?.quarterlyResults) return;
    
    const existing = kpi.quarterlyResults.find(
      (r) => String(r.quarter || '').toUpperCase() === String(form.quarter || '').toUpperCase()
    );

    setForm((prev) => ({
      ...prev,
      result: existing?.result || '',
      remark: existing?.remark || '',
    }));
  }, [form.quarter, kpi, open]);

  const evidenceRequired = Boolean(kpi?.evidenceRequired);

  const detailItems = useMemo(
    () => {
      const items = [
        { label: 'KPI Name', value: kpi?.name || '—' },
        { label: 'Baseline', value: formatValue(kpi?.baseline) },
        { label: 'Target', value: formatValue(kpi?.target) },
        { label: 'Theme', value: kpi?.theme || '—' },
        { label: 'Sub-theme', value: kpi?.subTheme || '—' },
        { label: 'Unit', value: kpi?.unit || '—' },
        { label: 'Remark', value: kpi?.remark || '—' },
      ];

      if (kpi?.aggregatedValue !== undefined && kpi?.aggregatedValue !== null && kpi?.aggregatedValue !== '—') {
        items.splice(1, 0, {
          label: 'Aggregated Performance (Children)',
          value: formatValue(kpi.aggregatedValue),
          isHighlighted: true
        });
      }

      return items;
    },
    [kpi]
  );

  const targetNum = useMemo(() => {
    if (!kpi?.target) return NaN;
    const str = String(kpi.target).replace(/,/g, '').trim();
    return parseFloat(str);
  }, [kpi?.target]);

  const previousTotal = useMemo(() => {
    if (!kpi?.quarterlyResults) return 0;
    const quarterMap = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    const currentQIdx = quarterMap[String(form.quarter || '').toUpperCase()] || 1;
    
    let sum = 0;
    kpi.quarterlyResults.forEach((r) => {
      const qIdx = quarterMap[String(r.quarter || r.Quarter || '').toUpperCase()] || 0;
      if (qIdx > 0 && qIdx < currentQIdx) {
        const val = r.AdjustedResult ?? r.KPIResult ?? r.kpiResult ?? r.result ?? r.value;
        const num = parseFloat(String(val).replace(/,/g, '').trim());
        if (!isNaN(num)) sum += num;
      }
    });
    return sum;
  }, [kpi?.quarterlyResults, form.quarter]);

  const currentValue = parseFloat(String(form.result).replace(/,/g, '').trim()) || 0;
  const projectedTotal = previousTotal + currentValue;
  const hasValidTarget = !isNaN(targetNum);
  const remainingGap = hasValidTarget ? Math.max(0, targetNum - projectedTotal) : null;
  const progressPercent = hasValidTarget ? Math.min(100, Math.max(0, (projectedTotal / targetNum) * 100)) : 0;

  const handleSubmit = async () => {
    if (form.result === '' || form.result === null || form.result === undefined) {
      notify('Please enter a performance result value.', 'warning');
      return;
    }

    if (evidenceRequired && !form.file) {
      notify('Evidence file is required for this KPI. Please upload a document.', 'error');
      return;
    }

    await onSubmit?.({
      quarter: form.quarter,
      result: form.result,
      remark: form.remark.trim(),
      file: form.file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[72vh] w-full max-w-3xl flex-col overflow-hidden border border-border/60 bg-background p-0 text-foreground shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-border bg-card px-4 py-3.5 sm:px-5">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-foreground">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Target className="h-4.5 w-4.5" />
              </span>
              Performance Form
            </DialogTitle>
            <DialogDescription className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Review the KPI details, choose a quarter, attach evidence if needed, and submit the performance result.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-3.5 shadow-sm ${item.isHighlighted ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                  <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${item.isHighlighted ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</div>
                  <div className={`mt-1.5 wrap-break-word text-sm font-semibold leading-5 ${item.isHighlighted ? 'text-primary' : 'text-foreground'}`}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground/80">
                  <CalendarDays className="h-4 w-4" />
                  Quarter
                </label>
                <select
                  value={form.quarter}
                  onChange={(event) => setForm((previous) => ({ ...previous, quarter: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-border bg-muted/50 px-3.5 text-sm text-foreground outline-none transition focus:border-primary focus:bg-card"
                >
                  {QUARTERS.map((quarter, index) => {
                    const quarterKey = quarter.toUpperCase();
                    const hasResult = kpi?.quarterlyResults?.some(
                      (r) => String(r.quarter || '').toUpperCase() === quarterKey
                    );
                    
                    let isAllowed = true;
                    if (index > 0) {
                      const prevQuarterKey = QUARTERS[index - 1].toUpperCase();
                      const prevHasResult = kpi?.quarterlyResults?.some(
                        (r) => String(r.quarter || '').toUpperCase() === prevQuarterKey
                      );
                      isAllowed = hasResult || prevHasResult;
                    }

                    return (
                      <option key={quarter} value={quarter} disabled={!isAllowed} className="bg-card">
                        {quarter} {!isAllowed ? '(Previous quarter missing)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col">
                <label className="mb-2.5 block text-sm font-semibold text-foreground/80">Performance Result</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.result}
                  onChange={(event) => setForm((previous) => ({ ...previous, result: event.target.value }))}
                  className="h-11 rounded-xl border-border bg-muted/50 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-0"
                  placeholder="Enter performance value"
                />
              </div>
            </div>

            {hasValidTarget && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground/80">Cumulative Progress (Including Previous Quarters)</span>
                  <span className="text-sm font-bold text-primary">{formatValue(projectedTotal)} / {formatValue(targetNum)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                  <div 
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2.5 flex justify-between text-xs font-medium">
                  {remainingGap !== null && remainingGap > 0 ? (
                    <span className="text-muted-foreground">Remaining Gap: <span className="text-foreground font-bold">{formatValue(remainingGap)}</span></span>
                  ) : remainingGap === 0 ? (
                    <span className="text-emerald-600 font-bold">Target Achieved! 🎉</span>
                  ) : projectedTotal > targetNum ? (
                    <span className="text-emerald-600 font-bold">Overachieved by {formatValue(projectedTotal - targetNum)}! 🚀</span>
                  ) : null}
                  <span className="text-primary font-bold">{progressPercent.toFixed(1)}%</span>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <label className="mb-2.5 block text-sm font-semibold text-foreground/80">Remarks</label>
              <textarea
                value={form.remark}
                onChange={(event) => setForm((previous) => ({ ...previous, remark: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 transition focus:border-primary focus:bg-card"
                placeholder="Add a short note about this performance entry"
              />
            </div>

            {evidenceRequired ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <FileUp className="h-4 w-4" />
                  Evidence File
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(event) => setForm((previous) => ({ ...previous, file: event.target.files?.[0] || null }))}
                  className="block w-full text-xs text-foreground/70 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                />
                {form.file ? <p className="mt-2 text-xs text-muted-foreground">Selected: {form.file.name}</p> : null}
                <p className="mt-1.5 text-xs text-amber-600/80 font-medium">This KPI requires an evidence file before submission.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-3 py-3 sm:px-4">
          <DialogFooter className="mx-auto flex w-full max-w-2xl flex-row justify-end gap-2.5 sm:rounded-none">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-w-20 px-3 py-2"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-32 px-4 py-2">
              {saving ? 'Submitting...' : 'Save Performance'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceSubmitModal;
