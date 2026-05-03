import { useEffect, useMemo, useState } from 'react';
import { Building2, Wrench, Zap, Target } from 'lucide-react';
import Button from '../UI/Button';
import { Input } from '../UI/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../UI/dialog';

const ICONS = [Building2, Wrench, Zap];
const COLORS = ['oklch(0.7 0.18 40)', 'oklch(0.65 0.16 230)', 'oklch(0.78 0.18 80)'];

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeInitialValues = (offices, initialValues = {}) => {
  const next = {};
  offices.forEach((office) => {
    const value = initialValues[office.key];
    next[office.key] = value === null || value === undefined ? '' : String(value);
  });
  return next;
};

const ChildOfficesModal = ({ open, onOpenChange, totalTarget, offices, initialValues, onSave, notify }) => {
  const mappedOffices = useMemo(
    () =>
      (offices || []).map((office, index) => ({
        ...office,
        icon: ICONS[index % ICONS.length],
        color: COLORS[index % COLORS.length],
      })),
    [offices]
  );

  const [draft, setDraft] = useState(() => normalizeInitialValues(mappedOffices, initialValues));

  useEffect(() => {
    if (open) {
      setDraft(normalizeInitialValues(mappedOffices, initialValues));
    }
  }, [open, initialValues, mappedOffices]);

  const allocated = Object.values(draft).reduce((sum, value) => sum + toNumber(value), 0);
  const remaining = Number(totalTarget || 0) - allocated;
  const progress = totalTarget > 0 ? Math.min(100, (allocated / totalTarget) * 100) : 0;

  const handleChange = (key, value) => {
    if (value !== '' && !/^\d+(\.\d{0,2})?$/.test(value)) return;

    const others = Object.entries(draft)
      .filter(([officeKey]) => officeKey !== key)
      .reduce((sum, [, officeValue]) => sum + toNumber(officeValue), 0);

    const max = Math.max(0, Number(totalTarget || 0) - others);

    let nextValue = value;
    if (value !== '' && Number(value) > max) {
      nextValue = String(max);
      notify?.(`Capped at ${max}. Only ${max} target${max === 1 ? '' : 's'} remaining.`, 'warning');
    }

    setDraft((previous) => ({ ...previous, [key]: nextValue }));
  };

  const handleSave = () => {
    if (remaining < 0) {
      notify?.('Allocation exceeds total target.', 'error');
      return;
    }

    onSave?.(draft);
    onOpenChange(false);

    notify?.(
      remaining === 0
        ? 'Custom allocation saved and fully distributed.'
        : `Custom allocation saved. ${remaining} target${remaining === 1 ? '' : 's'} unassigned.`,
      'success'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-0 bg-white p-0 text-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="border-b border-slate-100 px-7 pb-5 pt-7">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-slate-900">List of Child Offices</DialogTitle>
            <DialogDescription className="text-slate-500">Distribute targets. You cannot assign more than what remains.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <Target className="h-4 w-4" />
              Remaining Target
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${remaining === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{remaining}</span>
              <span className="text-sm text-slate-400">/ {totalTarget}</span>
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-linear-to-r from-indigo-500 via-sky-500 to-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4 px-7 py-6">
          {mappedOffices.map((office) => {
            const others = Object.entries(draft)
              .filter(([key]) => key !== office.key)
              .reduce((sum, [, value]) => sum + toNumber(value), 0);
            const max = Math.max(0, Number(totalTarget || 0) - others);
            const Icon = office.icon;

            return (
              <div key={office.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={`m-${office.key}`} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{
                        background: office.color.replace(')', ' / 0.15)'),
                        color: office.color,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {office.label}
                  </label>
                  <span className="text-xs text-slate-400">max {max}</span>
                </div>

                <Input
                  id={`m-${office.key}`}
                  inputMode="decimal"
                  placeholder="Enter value"
                  value={draft[office.key] ?? ''}
                  onChange={(event) => handleChange(office.key, event.target.value)}
                  className="h-11 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:ring-0"
                />
              </div>
            );
          })}

          {mappedOffices.length === 0 ? <p className="text-sm text-slate-500">No target office is available for custom allocation.</p> : null}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-7 py-4 sm:rounded-b-2xl">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-slate-900 text-white hover:bg-slate-800">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChildOfficesModal;
