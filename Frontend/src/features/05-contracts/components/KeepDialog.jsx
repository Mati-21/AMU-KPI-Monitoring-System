import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useContractPeople, useKeepPart } from '../hooks/useContracts';

const round = (value) => Math.round(value * 10000) / 10000;

/**
 * How much of a received KPI the office does itself, and who does it. What it keeps and what it gives to the offices
 * below together make the amount to share, so it can keep at most what the offices below have not been given. The
 * kept part goes on that person's staff contract for the year, the office head's unless another person is chosen.
 */
const KeepDialog = ({ assignment, office, onClose }) => {
  const { sharing } = assignment;
  const keep = useKeepPart();
  const { data: people = [] } = useContractPeople(true);
  const [amount, setAmount] = useState(sharing.retained ? String(sharing.retained) : '');
  const [chosen, setChosen] = useState(null);
  const most = round(sharing.parentAmount - sharing.distributed);
  const kept = amount === '' ? 0 : Number(amount);
  const tooMuch = kept > most;

  const staff = people.filter((person) => person.officeId === office.id);
  const holder = sharing.heldBy?.[0] ?? null;
  const head = staff.find((person) => person.isHead);
  // Whoever already holds the part keeps it; otherwise the head
  const personId = chosen ?? holder?.person.id ?? head?.id ?? '';
  const needsPerson = kept > 0 && !personId;

  const submit = (event) => {
    event.preventDefault();
    keep.mutate({ id: assignment.id, amount: kept, personId: kept > 0 ? personId : undefined }, { onSuccess: onClose });
  };

  return (
    <FormDialog open onClose={onClose} title="Keep for Our Office" description={assignment.kpi.name} onSubmit={submit} error={keep.error} pending={keep.isPending} submitDisabled={tooMuch || kept < 0 || needsPerson}>
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
      {kept > 0 && (
        <Field
          label="Who will do it?"
          group
          hint={
            staff.length === 0
              ? `${office.name} has no one to choose from yet.`
              : needsPerson
                ? `${office.name} has no head today, so choose a person.`
                : 'It goes on this person\'s contract for the year, made if they have none. They set their KPI weights before sending it.'
          }
        >
          <CustomSelect
            compact
            options={staff.map((person) => ({ value: person.id, label: `${person.name}${person.position ? `, ${person.position}` : ''}${person.isHead ? ' (head)' : ''}` }))}
            value={personId}
            onChange={setChosen}
            placeholder="Choose a person"
          />
        </Field>
      )}
    </FormDialog>
  );
};

export default KeepDialog;
