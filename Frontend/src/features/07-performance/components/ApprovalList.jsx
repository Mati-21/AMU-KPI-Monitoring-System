import { useNavigate } from 'react-router-dom';

import Button from '../../../shared/components/ui/Button';
import { formatEthiopianDate as formatDate } from '../../../shared/lib/ethiopianDate';
import { holderName, isStaffContract } from '../../05-contracts/lib/contractRules';
import RecordTable from '../../04-kpi-catalog/components/RecordTable';
import ReportStatus from './ReportStatus';

/**
 * Period results the offices below, and the staff of the person's own office, sent up, with a button to open each one.
 */
const ApprovalList = ({ title, description, reports, isLoading, error, emptyText, actionLabel }) => {
  const navigate = useNavigate();
  const columns = [
    { label: 'From', render: (row) => (isStaffContract(row.contract) ? `${holderName(row.contract)} (staff, ${row.contract.office.name})` : row.contract.office.name) },
    { label: 'Period', render: (row) => row.reportingPeriod.name },
    { label: 'Submitted', render: (row) => (row.submittedAt ? formatDate(row.submittedAt) : '-') },
    { label: 'Status', render: (row) => <ReportStatus status={row.status} isOverdue={row.isOverdue} isLate={row.isLate} /> },
    {
      label: 'Action',
      render: (row) => (
        <Button type="button" size="sm" variant={actionLabel === 'Review' ? 'default' : 'outline'} onClick={() => navigate(`/reports/${row.id}`)}>
          {actionLabel}
        </Button>
      ),
    },
  ];
  return <RecordTable title={title} description={description} columns={columns} rows={reports} isLoading={isLoading} error={error} emptyText={emptyText} />;
};

export default ApprovalList;
