import { useState } from 'react';
import { Ban, Edit3, Flag, FlagOff } from 'lucide-react';

import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useAssignmentStep } from '../hooks/useContracts';
import { assignmentActions, isFlagged } from '../lib/contractRules';

const COMMENT_FIELDS = [{ key: 'comment', label: 'Comment', type: 'textarea', required: true, hint: 'Kept with this KPI and in the system logs.' }];
const FLAG_FIELDS = [{ key: 'note', label: 'What Needs Correcting?', type: 'textarea', required: true, hint: 'The office above sees this note on the KPI.' }];

/**
 * The office above can change a KPI only while the contract is with them. While it waits for a signature,
 * the receiving office can flag the KPI with a note.
 */
const AssignmentActions = ({ assignment, contract, isClosed, onEdit }) => {
  const can = useCan();
  const { notify } = useNotification();
  const run = useAssignmentStep();
  const [cancelling, setCancelling] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const { kpi } = assignment;
  const { change: canChange, flag: canFlag } = assignmentActions(can, assignment, contract, isClosed);

  if (!canChange && !canFlag) return null;

  const closeFlag = () => {
    run.reset();
    setFlagging(false);
  };

  const removeFlag = () =>
    run.mutate(
      { id: assignment.id, step: 'flag', values: { note: null } },
      {
        onSuccess: () => notify(`Flag removed from ${kpi.name}.`, 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not remove this flag.'), 'error'),
      }
    );

  const closeCancel = () => {
    run.reset();
    setCancelling(false);
  };

  return (
    <>
      <div className="flex gap-2">
        {canChange && <IconAction icon={Edit3} label={`Edit ${kpi.name}`} onClick={onEdit} />}
        {canChange && <IconAction icon={Ban} label={`Cancel ${kpi.name}`} danger onClick={() => setCancelling(true)} />}
        {canFlag && <IconAction icon={Flag} label={`${isFlagged(assignment) ? 'Edit flag on' : 'Flag'} ${kpi.name}`} danger={isFlagged(assignment)} onClick={() => setFlagging(true)} />}
        {canFlag && isFlagged(assignment) && <IconAction icon={FlagOff} label={`Remove flag from ${kpi.name}`} onClick={removeFlag} />}
      </div>

      {flagging && <RecordDialog title={`Flag ${kpi.name}`} description="Say what the office above should correct." fields={FLAG_FIELDS} defaults={{ note: assignment.reviewComment }} mutation={{ ...run, mutate: ({ values }, options) => run.mutate({ id: assignment.id, step: 'flag', values }, options) }} submitLabel="Save Flag" successMessage={`${kpi.name} flagged.`} onClose={closeFlag} />}

      {cancelling && <RecordDialog title={`Cancel ${kpi.name}`} description="It stops counting on this contract. You can add it again later." fields={COMMENT_FIELDS} mutation={{ ...run, mutate: ({ values }, options) => run.mutate({ id: assignment.id, step: 'cancel', values }, options) }} submitLabel="Cancel KPI" successMessage={`${kpi.name} cancelled.`} onClose={closeCancel} />}
    </>
  );
};

export default AssignmentActions;
