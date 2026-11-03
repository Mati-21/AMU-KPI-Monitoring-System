import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { holderName } from '../../05-contracts/lib/contractRules';
import { REVIEW_DECISIONS } from '../lib/reportRules';

const TEXTAREA = 'w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The office above decides a report. Asking for revision or rejecting needs a comment: it is the office's feedback.
 */
export const ReviewDialog = ({ report, mutation, onClose, onDone }) => {
  const [decision, setDecision] = useState('APPROVED');
  const [comment, setComment] = useState('');
  const needsComment = decision !== 'APPROVED';

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ id: report.id, step: 'review', values: { decision, comment: comment.trim() || undefined } }, { onSuccess: () => onDone(decision) });
  };

  return (
    <FormDialog open onClose={onClose} title="Review Report" description={`${holderName(report.contract)}, ${report.reportingPeriod.name}`} onSubmit={submit} error={mutation.error} pending={mutation.isPending} submitLabel="Send Decision" submitDisabled={needsComment && !comment.trim()}>
      <Field label="Decision" required group>
        <CustomSelect compact options={REVIEW_DECISIONS} value={decision} onChange={setDecision} />
      </Field>
      <Field label="Comment" required={needsComment} hint={needsComment ? 'Tell the office what to correct.' : 'Optional.'}>
        <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className={TEXTAREA} />
      </Field>
    </FormDialog>
  );
};

/**
 * A Super Admin reopens an approved report to correct a mistake. The reason is kept in the system log.
 */
export const ReopenDialog = ({ report, mutation, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ id: report.id, step: 'reopen', values: { reason: reason.trim() } }, { onSuccess: onDone });
  };

  return (
    <FormDialog open onClose={onClose} title="Reopen Report" description="Its results stop counting until it is approved again, and everything that used them is recalculated." onSubmit={submit} error={mutation.error} pending={mutation.isPending} submitLabel="Reopen" submitDisabled={!reason.trim()}>
      <Field label="Reason" required>
        <textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={TEXTAREA} />
      </Field>
    </FormDialog>
  );
};
