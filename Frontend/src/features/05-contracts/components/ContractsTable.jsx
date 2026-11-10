import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import RecordTable, { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useContractOffices, useContractPeople, useCreateContract, useDeleteContract } from '../hooks/useContracts';
import { contractHolderOptions, holderName, holderPayload, isStaffContract, isUnassignedDraft, rejectedRow, statusLabel } from '../lib/contractRules';

const DIRECTIONS = {
  RECEIVED: { label: 'Received', className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200' },
  SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200' },
  SELF: { label: 'Self', className: 'bg-muted text-foreground' },
  STAFF: { label: 'Staff', className: 'bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200' },
  MINE: { label: 'Yours', className: 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200' },
};

/**
 * The year's contracts: between offices, and the staff contracts an office gives the people working in it.
 */
const ContractsTable = ({ year, contracts, onSelect, onShowHistory, isLoading, error }) => {
  const can = useCan();
  const create = useCreateContract();
  const remove = useDeleteContract();
  const { notify } = useNotification();
  const [deleting, setDeleting] = useState(null);
  const canAdd = can('contract:manage') && year.status !== 'CLOSED';
  const { data: offices = [] } = useContractOffices(canAdd);
  const { data: people = [] } = useContractPeople(canAdd);
  const [adding, setAdding] = useState(false);
  const options = contractHolderOptions(offices, people, contracts);

  const close = () => {
    create.reset();
    setAdding(false);
  };

  const mutation = {
    ...create,
    mutate: ({ values }, handlers) =>
      create.mutate(
        { fiscalYearId: year.id, ...holderPayload(values.forPerson ? values.personHolder : values.officeHolder) },
        {
          onSuccess: (contract) => {
            handlers.onSuccess();
            onSelect(contract.id);
          },
        }
      ),
  };

  const closeDelete = () => {
    remove.reset();
    setDeleting(null);
  };

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify(`The contract for ${holderName(deleting)} was deleted.`, 'success');
        closeDelete();
      },
    });

  const columns = [
    {
      label: 'Contract For',
      render: (row) => (
        <Button type="button" size="sm" variant="outline" onClick={() => onSelect(row.id)}>
          {holderName(row)}
        </Button>
      ),
    },
    {
      label: 'Direction',
      render: (row) => {
        const direction = DIRECTIONS[row.direction];
        return direction ? <span className={`rounded-md px-2 py-1 text-xs font-medium ${direction.className}`}>{direction.label}</span> : '-';
      },
    },
    { label: 'Assigned By', render: (row) => (isStaffContract(row) ? `${row.office.name} (staff contract)` : row.assigningOffice?.name ?? 'Self Contract') },
    { label: 'Status', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> },
    {
      label: 'Actions',
      render: (row) =>
        canAdd && isUnassignedDraft(row) ? (
          <div className="flex gap-1">
            <IconAction icon={Pencil} label={`Edit the contract for ${holderName(row)}`} onClick={() => onSelect(row.id)} />
            <IconAction icon={Trash2} danger label={`Delete the contract for ${holderName(row)}`} onClick={() => setDeleting(row)} />
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <RecordTable title="Contracts" description={`Each office has one contract for ${year.name} with the office directly above it, and can give staff contracts to the people working in it.`} addLabel="New Contract" onAdd={canAdd ? () => setAdding(true) : null} filter={<Button type="button" variant="outline" className="ml-auto" onClick={onShowHistory}>History</Button>} columns={columns} rows={contracts} rowClassName={rejectedRow} isLoading={isLoading} error={error} emptyText="No contracts for this year yet." />

      <ConfirmDialog open={Boolean(deleting)} onClose={closeDelete} title="Delete Contract" description={`Delete the draft contract for ${deleting ? holderName(deleting) : ''} with all its KPI lines? It was never assigned, so nothing is lost but the draft. This cannot be undone.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />

      {adding && (
        <RecordDialog
          title="New Contract"
          description="For an office directly below yours, or a staff contract for someone working in your office, yourself included. A staff contract takes its KPIs from your office's own contract."
          fields={[
            { key: 'forPerson', label: 'This contract is for a person (a staff contract), not an office', type: 'checkbox' },
            { key: 'officeHolder', label: 'Office', type: 'select', required: true, options: options.offices, visible: (form) => !form.forPerson, placeholder: options.offices.length ? 'Choose an office' : 'Every office already has a contract', hint: 'Offices that already hold a contract this year are not listed.' },
            { key: 'personHolder', label: 'Person', type: 'select', required: true, options: options.people, visible: (form) => form.forPerson, placeholder: options.people.length ? 'Choose a person' : 'Everyone already has a contract', hint: 'People who already hold a contract this year are not listed.' },
          ]}
          mutation={mutation}
          submitLabel="Create Contract"
          successMessage="Contract created."
          onClose={close}
        />
      )}
    </>
  );
};

export default ContractsTable;
