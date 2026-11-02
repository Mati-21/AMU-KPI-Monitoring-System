import Button from '../../../shared/components/ui/Button';
import { formatDate } from '../../02-offices/lib/officeTree';
import RecordTable from '../../04-kpi-catalog/components/RecordTable';
import { useRejections } from '../hooks/useContracts';

const fullName = (person) => (person ? [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') : '-');

const COLUMNS = [
  { label: 'Office', render: (row) => <span className="font-medium text-foreground">{row.contract.office.name}</span> },
  { label: 'Assigned By', render: (row) => row.contract.assigningOffice?.name ?? 'Self Contract' },
  { label: 'Rejected On', render: (row) => formatDate(row.rejectedAt) },
  { label: 'Rejected By', render: (row) => fullName(row.rejectedBy) },
  { label: 'Note', className: 'max-w-xs whitespace-normal', render: (row) => row.note ?? '-' },
  {
    label: 'Flagged KPIs',
    className: 'max-w-sm whitespace-normal',
    render: (row) =>
      row.flaggedKpis.length === 0 ? (
        '-'
      ) : (
        <ul className="space-y-1">
          {row.flaggedKpis.map((kpi) => (
            <li key={kpi.name}>
              <span className="font-medium text-foreground">{kpi.name}:</span> {kpi.note}
            </li>
          ))}
        </ul>
      ),
  },
];

/**
 * Every rejection of a contract this year. They stay here after the contract is corrected and assigned again.
 */
const RejectionHistory = ({ year, onBack }) => {
  const { data: rejections = [], isLoading, error } = useRejections(year.id);

  return <RecordTable title="Rejected Contracts" description={`Contracts rejected in ${year.name}, with the reasons given at the time.`} filter={<Button type="button" variant="outline" onClick={onBack}>Back to Contracts</Button>} columns={COLUMNS} rows={rejections} isLoading={isLoading} error={error} emptyText="No contract has been rejected this year." />;
};

export default RejectionHistory;
