import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileUp, Target } from 'lucide-react';
import Button from '../UI/Button';
import { Input } from '../UI/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../UI/dialog';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const getCurrentQuarter = (date = new Date()) => {
  const month = date.getMonth() + 1;

  if (month >= 8 && month <= 10) return 'Q1';
  if (month >= 11 || month <= 1) return 'Q2';
  if (month >= 2 && month <= 4) return 'Q3';
  return 'Q4';
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

const createInitialForm = (quarter = getCurrentQuarter(), initialValues = {}) => ({
  quarter: initialValues.quarter || quarter,
  result: initialValues.result || '',
  remark: initialValues.remark || '',
  file: null,
});

const PerformanceSubmitModal = ({ open, onOpenChange, kpi, initialValues, onSubmit, saving }) => {
  const [form, setForm] = useState(() => createInitialForm());

  useEffect(() => {
    if (!open) return;
    setForm(
      createInitialForm(getCurrentQuarter(), {
        quarter: initialValues?.quarter,
        result: initialValues?.result || '',
        remark: initialValues?.remark || '',
      })
    );
  }, [open, initialValues, kpi]);

  const evidenceRequired = Boolean(kpi?.evidenceRequired);
  const isDerivedKpi = Boolean(kpi?.isDerived);

  const detailItems = useMemo(
    () => [
      { label: 'KPI Name', value: kpi?.name || '—' },
      { label: 'Baseline', value: formatValue(kpi?.baseline) },
      { label: 'Target', value: formatValue(kpi?.target) },
      ...(isDerivedKpi
        ? []
        : [
            { label: 'Theme', value: kpi?.theme || '—' },
            { label: 'Sub-theme', value: kpi?.subTheme || '—' },
          ]),
      { label: 'Unit', value: kpi?.unit || '—' },
      { label: 'Remark', value: kpi?.remark || '—' },
    ],
    [kpi, isDerivedKpi]
  );

  const handleSubmit = async () => {
    if (form.result === '' || form.result === null || form.result === undefined) {
      return;
    }

    if (evidenceRequired && !form.file) {
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
      <DialogContent className="flex max-h-[72vh] w-full max-w-3xl flex-col overflow-hidden border-0 bg-slate-50 p-0 text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-5">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-slate-900">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600">
                <Target className="h-4.5 w-4.5" />
              </span>
              Performance Form
            </DialogTitle>
            <DialogDescription className="mt-1 max-w-2xl text-sm text-slate-500">
              Review the KPI details, choose a quarter, attach evidence if needed, and submit the performance result.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                  <div className="mt-1.5 wrap-break-word text-sm font-semibold leading-5 text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarDays className="h-4 w-4" />
                  Quarter
                </label>
                <select
                  value={form.quarter}
                  onChange={(event) => setForm((previous) => ({ ...previous, quarter: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                >
                  {QUARTERS.map((quarter) => (
                    <option key={quarter} value={quarter}>
                      {quarter}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2.5 block text-sm font-semibold text-slate-700">Performance Result</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.result}
                  onChange={(event) => setForm((previous) => ({ ...previous, result: event.target.value }))}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:ring-0"
                  placeholder="Enter performance value"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-2.5 block text-sm font-semibold text-slate-700">Remarks</label>
              <textarea
                value={form.remark}
                onChange={(event) => setForm((previous) => ({ ...previous, remark: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-slate-900 focus:bg-white"
                placeholder="Add a short note about this performance entry"
              />
            </div>

            {evidenceRequired ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <FileUp className="h-4 w-4" />
                  Evidence File
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(event) => setForm((previous) => ({ ...previous, file: event.target.files?.[0] || null }))}
                  className="block w-full text-xs text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                />
                {form.file ? <p className="mt-2 text-xs text-slate-500">Selected: {form.file.name}</p> : null}
                <p className="mt-1.5 text-xs text-amber-800">This KPI requires an evidence file before submission.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
          <DialogFooter className="mx-auto flex w-full max-w-2xl flex-row justify-end gap-2.5 sm:rounded-none">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-w-20 px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-32 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800">
              {saving ? 'Submitting...' : 'Save Performance'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceSubmitModal;
