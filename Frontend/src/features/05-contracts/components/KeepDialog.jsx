import { useState } from 'react';

import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useKeepPart } from '../hooks/useContracts';

const round = (value) => Math.round(value * 10000) / 10000;

/**
 * How much of a received KPI the office does itself. What it keeps and what it gives to the offices below together
 * make the amount to share, so it can keep at most what the offices below have not been given.
 */
const KeepDialog = ({ assignment, office, onClose }) => {
  const { sharing } = assignment;
  const keep = useKeepPart();
  const [amount, setAmount] = useState(sharing.retained ? String(sharing.retained) : '');
  const most = round(sharing.parentAmount - sharing.distributed);
  const kept = amount === '' ? 0 : Number(amount);
  const tooMuch = kept > most;

  const submit = (event) => {
    event.preventDefault();
    keep.mutate({ id: assignment.id, amount: kept }, { onSuccess: onClose });
  };

  return (
    <FormDialog open onClose={onClose} title="Keep for Our Office" description={assignment.kpi.name} onSubmit={submit} error={keep.error} pending={keep.isPending} submitDisabled={tooMuch || kept < 0}>
      <div className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">To Share</p>
          <p className="font-semibold text-foreground">{sharing.parentAmount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Given to Offices Below</p>
          <p className="font-semibold text-foreground">{sharing.distributed}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Left to Give</p>
          <p className="font-semibold text-foreground">{round(Math.max(0, most - kept))}</p>
        </div>
      </div>
      <Field label={`How much will ${office.name} do itself?`} hint={tooMuch ? `At most ${most} can be kept.` : `Up to ${most}. Leave empty or 0 to keep nothing.`}>
        <Input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
    </FormDialog>
  );
};

export default KeepDialog;
