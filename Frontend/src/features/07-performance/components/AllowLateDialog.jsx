import { useState } from 'react';

import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useAllowLate } from '../hooks/useReports';

const TEXTAREA = 'w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The Super Admin lets one office submit a period after its deadline and grace period. The submission is marked late,
 * and the reason (for example the penalty agreed) is kept in the system log.
 */
const AllowLateDialog = ({ contractId, officeName, period, onClose }) => {
  const { notify } = useNotification();
  const allow = useAllowLate();
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const validDays = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 60;

  const submit = (event) => {
    event.preventDefault();
    allow.mutate(
      { contractId, reportingPeriodId: period.id, days: Number(days), reason: reason.trim() },
      {
        onSuccess: () => {
          notify(`${officeName} can submit ${period.name} for ${days} more day(s).`, 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title="Allow Late Submission" description={`${officeName}, ${period.name}. The submission will be marked late.`} onSubmit={submit} error={allow.error} pending={allow.isPending} submitLabel="Allow" submitDisabled={!validDays || !reason.trim()}>
      <Field label="Open for How Many Days?" required hint="From today, 1 to 60 days.">
        <Input type="number" min="1" max="60" step="1" value={days} onChange={(event) => setDays(event.target.value)} />
      </Field>
      <Field label="Reason" required hint="For example the penalty agreed. Kept in the system log.">
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={TEXTAREA} />
      </Field>
    </FormDialog>
  );
};

export default AllowLateDialog;
