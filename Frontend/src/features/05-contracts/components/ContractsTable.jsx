import { useState } from 'react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import RecordTable from '../../04-kpi-catalog/components/RecordTable';
import { useContractOffices, useCreateContract } from '../hooks/useContracts';
import { contractOfficeOptions, rejectedRow, statusLabel } from '../lib/contractRules';

const DIRECTIONS = {
  RECEIVED: { label: 'Received', className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200' },
  SENT: { label: 'Sent', className: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200' },
  SELF: { label: 'Self', className: 'bg-muted text-foreground' },
};

const ContractsTable = ({ year, contracts, onSelect, onShowHistory, isLoading, error }) => {
  const can = useCan();
  const create = useCreateContract();
  const canAdd = can('contract:manage') && year.status !== 'CLOSED';
  const { data: offices = [] } = useContractOffices(canAdd);
  const [adding, setAdding] = useState(false);
  const options = contractOfficeOptions(offices, contracts);

  const close = () => {
    create.reset();
    setAdding(false);
  };

  const mutation = {
    ...create,
    mutate: ({ values }, handlers) =>
      create.mutate(
        { fiscalYearId: year.id, ...values },
        {
          onSuccess: (contract) => {
            handlers.onSuccess();
            onSelect(contract.id);
          },
        }
      ),
  };

  const columns = [
    {
      label: 'Office',
      render: (row) => (
        <Button type="button" size="sm" variant="outline" onClick={() => onSelect(row.id)}>
          {row.office.name}
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
    { label: 'Assigned By', render: (row) => row.assigningOffice?.name ?? 'Self Contract' },
    { label: 'Status', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> },
  ];

  return (
    <>
      <RecordTable title="Contracts" description={`Each office has one contract for ${year.name}, with the office directly above it.`} addLabel="New Contract" onAdd={canAdd ? () => setAdding(true) : null} filter={<Button type="button" variant="outline" className="ml-auto" onClick={onShowHistory}>History</Button>} columns={columns} rows={contracts} rowClassName={rejectedRow} isLoading={isLoading} error={error} emptyText="No contracts for this year yet." />

      {adding && (
        <RecordDialog
          title="New Contract"
          description="The office above the one you choose becomes its assigning office. Start with the top office, because KPIs pass down from there."
          fields={[{ key: 'officeId', label: 'Office', type: 'select', required: true, options, placeholder: options.length ? 'Choose an office' : 'Every office already has a contract', hint: 'Only offices directly below yours are listed, and not those already holding a contract this year.' }]}
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
