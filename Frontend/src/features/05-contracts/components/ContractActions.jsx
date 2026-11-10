import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useContractStep, useDeleteContract } from '../hooks/useContracts';
import { canReceive, flaggedCount, holderName, isOpen, isUnassignedDraft } from '../lib/contractRules';

/**
 * The office above assigns the contract. The receiving office then signs it, or rejects it with flags on its KPIs,
 * an overall note, or both. A self contract is never assigned: the top office signs it once it is complete.
 * A staff contract is assigned by the office and signed or rejected only by its person.
 * The backend has the final say, including which office the person may act on.
 */
const ContractActions = ({ contract }) => {
  const can = useCan();
  const { notify } = useNotification();
  const step = useContractStep();
  const remove = useDeleteContract();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const { status } = contract;
  const holder = holderName(contract);
  const isSelf = !contract.assigningOfficeId;
  const flagged = flaggedCount(contract);

  const confirms = {
    assign: { title: 'Assign Contract', confirmLabel: 'Assign', done: `Contract assigned to ${holder}.`, description: `${holder} will review it, then sign it or reject it with a note. You cannot change it while it is with them.` },
    sign: { title: 'Accept and Sign', confirmLabel: 'Accept and Sign', done: 'Contract signed.', description: `This accepts every KPI, target and weight on this contract for ${holder}. After signing, values change only through a change request.` },
    selfSign: { step: 'sign', title: 'Approve and Sign', confirmLabel: 'Approve and Sign', done: 'Self contract signed.', description: `This approves every KPI, target and weight of ${holder}'s own plan. Its KPIs can then pass down to the offices below, and values change only through a change request.` },
  };

  if (contract.fiscalYear.status === 'CLOSED') return null;

  const closeConfirm = () => {
    step.reset();
    setConfirming(null);
  };

  const confirm = () =>
    step.mutate(
      { id: contract.id, step: confirms[confirming].step ?? confirming },
      {
        onSuccess: () => {
          notify(confirms[confirming].done, 'success');
          closeConfirm();
        },
      }
    );

  const closeDelete = () => {
    remove.reset();
    setDeleting(false);
  };

  const confirmDelete = () =>
    remove.mutate(contract.id, {
      onSuccess: () => {
        notify(`The contract for ${holder} was deleted.`, 'success');
        navigate(`/assign-kpi?year=${contract.fiscalYear.id}`);
      },
    });

  const closeReject = () => {
    step.reset();
    setRejecting(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {isSelf && can('contract:acknowledge') && status === 'DRAFT' && (
          <Button type="button" size="sm" onClick={() => setConfirming('selfSign')}>
            Approve and Sign
          </Button>
        )}
        {!isSelf && can('contract:manage') && isOpen(contract) && (
          <Button type="button" size="sm" onClick={() => setConfirming('assign')}>
            Assign to {holder}
          </Button>
        )}
        {can('contract:manage') && isUnassignedDraft(contract) && (
          <Button type="button" size="sm" variant="destructive" className="gap-1" onClick={() => setDeleting(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Draft
          </Button>
        )}
        {canReceive(can, contract) && status === 'SUBMITTED' && (
          <>
            <Button type="button" size="sm" disabled={flagged > 0} title={flagged > 0 ? 'Remove the flags to sign' : undefined} onClick={() => setConfirming('sign')}>
              Accept and Sign
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => setRejecting(true)}>
              Reject Contract
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog open={deleting} onClose={closeDelete} title="Delete Contract" description={`Delete the draft contract for ${holder} with all its KPI lines? It was never assigned, so nothing is lost but the draft. This cannot be undone.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />
      {confirming && <ConfirmDialog open onClose={closeConfirm} title={confirms[confirming].title} description={confirms[confirming].description} onConfirm={confirm} error={step.error} pending={step.isPending} confirmLabel={confirms[confirming].confirmLabel} confirmVariant="default" />}
      {rejecting && <RecordDialog title="Reject Contract" description={`It goes back to the office above to correct and assign again.${flagged > 0 ? ` ${flagged} flagged KPI(s) go with it.` : ''}`} fields={[{ key: 'comment', label: 'Note for the Whole Contract', type: 'textarea', required: flagged === 0, hint: flagged > 0 ? 'Optional, because your flags already say what to correct.' : 'Say what needs correcting, or cancel and flag the KPIs instead.' }]} mutation={{ ...step, mutate: ({ values }, options) => step.mutate({ id: contract.id, step: 'reject', values }, options) }} submitLabel="Reject" successMessage="Contract rejected." onClose={closeReject} />}
    </>
  );
};

export default ContractActions;
