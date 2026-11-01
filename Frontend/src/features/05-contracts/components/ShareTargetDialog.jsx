import { useState } from 'react';

import Button from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useAllocations, useSaveAllocations } from '../hooks/useContracts';
import { equalShares, statusLabel } from '../lib/contractRules';
import ShareState from './ShareState';

const startingLines = (sharing) => [
  ...sharing.offices.map((line) => ({ ...line, chosen: true, value: line.amount === null ? '' : String(line.amount) })),
  ...sharing.candidates.map((office) => ({ office, assignmentId: null, status: null, locked: false, chosen: false, value: '' })),
];

/**
 * Share a KPI's improvement between the offices below. Everything is saved together, because the total has to reach
 * the improvement. An office already holding the KPI stays on the list, and once it has it the amount is fixed.
 */
const ShareForm = ({ assignment, sharing, readOnly, onClose }) => {
  const { notify } = useNotification();
  const save = useSaveAllocations();
  const [lines, setLines] = useState(() => startingLines(sharing));
  const [retained, setRetained] = useState(sharing.retained ? String(sharing.retained) : '');
  const [method, setMethod] = useState('CUSTOM');

  const chosen = lines.filter((line) => line.chosen);
  const total = chosen.reduce((sum, line) => sum + Number(line.value || 0), Number(retained || 0));
  const difference = Math.round((total - sharing.parentAmount) * 10000) / 10000;
  const allFilled = chosen.every((line) => Number(line.value) > 0 || (line.locked && line.value === ''));

  const change = (officeId, values) => {
    setMethod('CUSTOM');
    setLines(lines.map((line) => (line.office.id === officeId ? { ...line, ...values } : line)));
  };

  const shareEqually = () => {
    const free = chosen.filter((line) => !line.locked);
    const fixed = chosen.filter((line) => line.locked).reduce((sum, line) => sum + Number(line.value || 0), Number(retained || 0));
    const amounts = equalShares(sharing.parentAmount - fixed, free.length);
    setMethod('EQUAL');
    setLines(lines.map((line) => (free.includes(line) ? { ...line, value: String(amounts[free.indexOf(line)]) } : line)));
  };

  const close = () => {
    save.reset();
    onClose();
  };

  const submit = (event) => {
    event.preventDefault();
    const shares = chosen.filter((line) => line.value !== '').map((line) => ({ officeId: line.office.id, amount: Number(line.value) }));
    save.mutate(
      { id: assignment.id, values: { distributionMethod: method, retainedAmount: Number(retained || 0), shares } },
      {
        onSuccess: () => {
          notify(`${assignment.kpi.code} shared.`, 'success');
          close();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={close} className="sm:max-w-2xl" title={`Share ${assignment.kpi.code}`} description={assignment.kpi.name} onSubmit={readOnly ? close : submit} error={save.error} pending={save.isPending} submitLabel={readOnly ? 'Close' : 'Save Shares'} submitDisabled={!readOnly && (difference < 0 || !allFilled)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm text-foreground">
        <p>
          To share: <span className="font-semibold">{sharing.parentAmount}</span>. Assigned: <span className="font-semibold">{total}</span>.
        </p>
        <ShareState difference={difference} />
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-border p-3 text-sm text-foreground">This office has no active office below it to share with.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {lines.map((line) => (
            <div key={line.office.id} className="flex items-center gap-3 p-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={line.chosen} disabled={readOnly || Boolean(line.assignmentId)} onChange={(event) => change(line.office.id, { chosen: event.target.checked, value: event.target.checked ? line.value : '' })} />
                <span className="truncate">{line.office.name}</span>
                {line.status && <span className="shrink-0 text-xs text-muted-foreground">{statusLabel(line.status)}</span>}
              </label>
              <Input type="number" aria-label={`Share for ${line.office.name}`} min="0.0001" step="any" className="w-32" value={line.value} disabled={readOnly || line.locked || !line.chosen} onChange={(event) => change(line.office.id, { value: event.target.value })} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={`Kept by ${assignment.office.name}`} hint="Counts towards the amount to assign.">
          <Input type="number" min="0" step="any" className="w-32" value={retained} disabled={readOnly} onChange={(event) => setRetained(event.target.value)} />
        </Field>
        {!readOnly && (
          <Button type="button" variant="outline" disabled={chosen.every((line) => line.locked)} onClick={shareEqually}>
            Share Equally
          </Button>
        )}
      </div>
    </FormDialog>
  );
};

const ShareTargetDialog = ({ assignment, readOnly, onClose }) => {
  const { data: sharing, error, isLoading } = useAllocations(assignment.id);

  if (isLoading || error) {
    return (
      <FormDialog open onClose={onClose} title={`Share ${assignment.kpi.code}`} description={assignment.kpi.name} onSubmit={(event) => event.preventDefault()} error={error} submitDisabled>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      </FormDialog>
    );
  }
  return <ShareForm assignment={assignment} sharing={sharing} readOnly={readOnly} onClose={onClose} />;
};

export default ShareTargetDialog;
