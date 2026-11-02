import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Flag } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordTable from '../../04-kpi-catalog/components/RecordTable';
import { useAllKpis, useContract } from '../hooks/useContracts';
import { assignableKpis, isApproved, isFlagged, isOpen, measureText, nextStep, rejectedRow, statusLabel } from '../lib/contractRules';
import AssignmentActions from './AssignmentActions';
import AssignmentFormDialog from './AssignmentFormDialog';
import ContractActions from './ContractActions';
import ShareState from './ShareState';
import ShareTargetDialog from './ShareTargetDialog';

// How a KPI that is not divided between the offices below reaches them
const UNDIVIDED = { FULL: 'Fully, to each office', CUSTOM: 'Custom targets' };

const Fact = ({ label, children }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-medium text-foreground">{children}</div>
  </div>
);

const ContractDetail = ({ contractId, contracts }) => {
  const can = useCan();
  const navigate = useNavigate();
  const { data: contract, isLoading, error } = useContract(contractId);
  const parentSummary = contracts.find((candidate) => candidate.officeId === contract?.assigningOfficeId);
  const { data: parentContract } = useContract(parentSummary?.id);
  const { data: kpis = [] } = useAllKpis();
  const [dialog, setDialog] = useState(null);
  const [sharing, setSharing] = useState(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contract...</p>;
  if (error) return <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load this contract.')}</p>;

  const isClosed = contract.fiscalYear.status === 'CLOSED';
  const canAdd = can('contract:manage') && !isClosed && isOpen(contract);
  // New KPIs come from the ministry into the top office's own plan, so only a draft self contract takes them
  const canRegister = canAdd && !contract.assigningOfficeId && contract.status === 'DRAFT';
  const step = nextStep(contract);

  const columns = [
    {
      label: 'KPI',
      render: (row) => (
        <>
          {row.kpi.name}
          {row.reviewComment && (
            <p className="flex items-start gap-1 whitespace-normal text-xs text-red-500">
              {isFlagged(row) && <Flag className="mt-0.5 h-3 w-3 shrink-0" role="img" aria-label="Flagged" />}
              {row.reviewComment}
            </p>
          )}
        </>
      ),
    },
    {
      label: 'Baseline',
      render: (row) => (
        <span className="flex items-center gap-1">
          {measureText(row.kpi, row.baseline)}
          {row.baseline?.baselineStatus === 'VERIFIED' && <BadgeCheck className="h-4 w-4 text-green-700 dark:text-green-400" role="img" aria-label="Verified" />}
        </span>
      ),
    },
    { label: 'Target', render: (row) => measureText(row.kpi, row.target) },
    { label: 'Improvement', render: (row) => row.requiredImprovement ?? '-' },
    {
      label: 'Shared',
      render: (row) => {
        if (!row.sharing?.shareable) return <span className="text-xs text-muted-foreground">{UNDIVIDED[row.sharing?.method] ?? 'Same target'}</span>;
        if (!isApproved(row)) return '-';
        return (
          <button type="button" aria-label={`Share ${row.kpi.name}`} onClick={() => setSharing(row)} className="text-left hover:underline">
            <span className="block text-sm text-foreground">{row.sharing.assigned} of {row.sharing.parentAmount}</span>
            <ShareState difference={row.sharing.difference} />
          </button>
        );
      },
    },
    { label: 'Weight', render: (row) => row.weight ?? '-' },
    { label: 'Frequency', render: (row) => row.reportingFrequency?.name ?? '-' },
    { label: 'Status', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> },
    { label: 'Actions', render: (row) => <AssignmentActions assignment={row} contractStatus={contract.status} isClosed={isClosed} onEdit={() => setDialog({ assignment: row })} /> },
  ];

  return (
    <>
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">{contract.office.name}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Fact label="Fiscal Year">{contract.fiscalYear.name}</Fact>
          <Fact label="Assigned By">{contract.assigningOffice?.name ?? 'Self Contract'}</Fact>
          <Fact label="Status">
            <Badge variant="outline">{statusLabel(contract.status)}</Badge>
          </Fact>
          <Fact label="Weight Total">
            <span className={contract.isWeightBalanced ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
              {contract.totalWeight} of {contract.requiredTotalWeight}
            </span>
          </Fact>
        </div>
        {contract.reviewComment && <p className="text-sm text-red-500">Rejected by {contract.office.name}: {contract.reviewComment}</p>}
        {step && (
          <p className="text-sm text-foreground">
            <span className="font-medium">Next:</span> {step}
          </p>
        )}
        <ContractActions contract={contract} />
      </div>

      <RecordTable title="KPIs on This Contract" addLabel="Add KPI" onAdd={canAdd ? () => setDialog({}) : null} filter={canRegister ? <Button type="button" variant="outline" className="ml-auto" onClick={() => navigate(`/assign-kpi/${contract.id}/register`)}>Register New KPIs</Button> : null} columns={columns} rows={contract.assignments} rowClassName={rejectedRow} emptyText="No KPIs on this contract yet." />

      {dialog && <AssignmentFormDialog contract={contract} assignment={dialog.assignment} kpi={kpis.find((kpi) => kpi.id === dialog.assignment?.kpi.id)} parentContract={parentContract} choices={assignableKpis(contract, kpis, parentContract)} onClose={() => setDialog(null)} />}

      {sharing && <ShareTargetDialog assignment={sharing} readOnly={!can('contract:manage') || isClosed} onClose={() => setSharing(null)} />}
    </>
  );
};

export default ContractDetail;
