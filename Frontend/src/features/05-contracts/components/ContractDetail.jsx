import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Flag } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordTable from '../../04-kpi-catalog/components/RecordTable';
import { useAllKpis, useContract } from '../hooks/useContracts';
import { unitText } from '../../07-performance/lib/sheetRules';
import { assignableKpis, assignmentActions, holderName, isApproved, isFlagged, isOpen, isStaffContract, measureText, nextStep, rejectedRow, sourceContractOf, statusLabel } from '../lib/contractRules';
import AssignmentActions from './AssignmentActions';
import AssignmentFormDialog from './AssignmentFormDialog';
import ContractActions from './ContractActions';
import KeepDialog from './KeepDialog';

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
  // Where its KPIs come from: the office above, or for a staff contract the office's own contract
  const parentSummary = contract ? sourceContractOf(contract, contracts) : null;
  const { data: parentContract } = useContract(parentSummary?.id);
  const { data: kpis = [] } = useAllKpis();
  const [dialog, setDialog] = useState(null);
  const [keeping, setKeeping] = useState(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contract...</p>;
  if (error) return <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load this contract.')}</p>;

  const isClosed = contract.fiscalYear.status === 'CLOSED';
  const isStaff = isStaffContract(contract);
  const canAdd = can('contract:manage') && !isClosed && isOpen(contract);
  // New KPIs come from the ministry into the top office's own plan, so only a draft self contract takes them
  const canRegister = canAdd && !contract.assigningOfficeId && contract.status === 'DRAFT';
  const step = nextStep(contract);
  // The Actions column only shows while some KPI can still be edited, cancelled or flagged
  const hasActions = contract.assignments.some((row) => Object.values(assignmentActions(can, row, contract, isClosed)).some(Boolean));
  // Only the office that received the contract decides how much of a KPI it does itself
  const ownContract = ['RECEIVED', 'SELF'].includes(contracts.find((candidate) => candidate.id === contract.id)?.direction);
  const canKeep = can('contract:manage') && !isClosed && ownContract && !isStaff;

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
    { label: 'Unit', render: (row) => unitText(row.kpi) },
    {
      label: 'Baseline',
      render: (row) => (
        <span className="flex items-center gap-1">
          {measureText(row.kpi, row.baseline, false)}
          {row.baseline?.baselineStatus === 'VERIFIED' && <BadgeCheck className="h-4 w-4 text-green-700 dark:text-green-400" role="img" aria-label="Verified" />}
        </span>
      ),
    },
    { label: 'Target', render: (row) => measureText(row.kpi, row.target, false) },
    { label: 'Improvement', render: (row) => row.requiredImprovement ?? '-' },
    // One person's work is not shared any further
    !isStaff && {
      label: 'Shared',
      render: (row) => {
        if (!row.sharing?.shareable) return <span className="text-xs text-muted-foreground">{UNDIVIDED[row.sharing?.method] ?? 'Same target'}</span>;
        if (!isApproved(row)) return '-';
        const { parentAmount, distributed, retained } = row.sharing;
        const left = Math.round((parentAmount - distributed - retained) * 10000) / 10000;
        return (
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              Given {distributed}
              {retained > 0 && ` · Kept ${retained}`} of {parentAmount}
            </p>
            <p className={`text-xs font-medium ${left > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{left > 0 ? `${left} left to give` : 'All shared'}</p>
            {canKeep && (
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setKeeping(row)}>
                Keep for Our Office
              </Button>
            )}
          </div>
        );
      },
    },
    { label: 'Weight', render: (row) => row.weight ?? '-' },
    { label: 'Frequency', render: (row) => row.reportingFrequency?.name ?? '-' },
    { label: 'Status', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> },
    ...(hasActions ? [{ label: 'Actions', render: (row) => <AssignmentActions assignment={row} contract={contract} isClosed={isClosed} onEdit={() => setDialog({ assignment: row })} /> }] : []),
  ].filter(Boolean);

  return (
    <>
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">{isStaff ? `${holderName(contract)}, ${contract.office.name}` : contract.office.name}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Fact label="Fiscal Year">{contract.fiscalYear.name}</Fact>
          <Fact label="Assigned By">{isStaff ? `${contract.office.name} (staff contract)` : contract.assigningOffice?.name ?? 'Self Contract'}</Fact>
          <Fact label="Status">
            <Badge variant="outline">{statusLabel(contract.status)}</Badge>
          </Fact>
          <Fact label="Weight Total">
            <span className={contract.isWeightBalanced ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
              {contract.totalWeight} of {contract.requiredTotalWeight}
            </span>
          </Fact>
        </div>
        {contract.reviewComment && <p className="text-sm text-red-500">Rejected by {holderName(contract)}: {contract.reviewComment}</p>}
        {step && (
          <p className="text-sm text-foreground">
            <span className="font-medium">Next:</span> {step}
          </p>
        )}
        <ContractActions contract={contract} />
      </div>

      <RecordTable title="KPIs on This Contract" addLabel="Add KPI" onAdd={canAdd ? () => setDialog({}) : null} filter={canRegister ? <Button type="button" variant="outline" className="ml-auto" onClick={() => navigate(`/assign-kpi/${contract.id}/register`)}>Register New KPIs</Button> : null} columns={columns} rows={contract.assignments} rowClassName={rejectedRow} emptyText="No KPIs on this contract yet." />

      {dialog && <AssignmentFormDialog contract={contract} assignment={dialog.assignment} kpi={kpis.find((kpi) => kpi.id === dialog.assignment?.kpi.id)} parentContract={parentContract} choices={assignableKpis(contract, kpis, parentContract)} onClose={() => setDialog(null)} />}

      {keeping && <KeepDialog assignment={keeping} office={contract.office} onClose={() => setKeeping(null)} />}
    </>
  );
};

export default ContractDetail;
