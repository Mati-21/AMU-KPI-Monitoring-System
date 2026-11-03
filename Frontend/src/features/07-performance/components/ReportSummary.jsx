import { formatEthiopianDate as formatDate } from '../../../shared/lib/ethiopianDate';
import { holderName, isStaffContract } from '../../05-contracts/lib/contractRules';
import { formatDateTime } from '../../10-system/lib/auditFormat';
import { reportStatusLabel } from '../lib/reportRules';
import DeadlineNote from './DeadlineNote';
import ReportStatus from './ReportStatus';

const Fact = ({ label, children }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground">{children}</p>
  </div>
);

const fullName = (person) => (person ? `${person.firstName} ${person.lastName}` : '');

/**
 * Who reports, for which period, by when, and the decisions taken on it so far.
 */
const ReportSummary = ({ report }) => {
  const { reportingPeriod: period } = report;
  const latest = report.reviews[0];
  const sentBack = latest && ['REVISION_REQUIRED', 'REJECTED'].includes(report.status) && latest.decision === report.status;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label={isStaffContract(report.contract) ? 'Staff' : 'Office'}>{holderName(report.contract)}</Fact>
        <Fact label="Reports To">{report.contract.assigningOffice?.name ?? 'Its own Self Contract'}</Fact>
        <Fact label="Period">{period.name}</Fact>
        <Fact label="Dates">{`${formatDate(period.startDate)} - ${formatDate(period.endDate)}`}</Fact>
        <Fact label="Deadline">{period.submissionDeadline ? formatDate(period.submissionDeadline) : 'None'}</Fact>
        <Fact label="Status">
          <ReportStatus status={report.status} isOverdue={report.isOverdue} isLate={report.isLate} />
        </Fact>
      </div>
      <DeadlineNote period={report.reportingPeriod} deadline={report.can.deadline} report={report} />

      {sentBack && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">{reportStatusLabel(report.status)} by {fullName(latest.reviewer)}</p>
          <p>{latest.comment}</p>
        </div>
      )}

      {report.reviews.length > 0 && (
        <details className="rounded-lg border border-border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Review history ({report.reviews.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {report.reviews.map((review) => (
              <li key={review.id} className="text-foreground">
                <span className="font-medium">{reportStatusLabel(review.decision)}</span> by {fullName(review.reviewer)}, {formatDateTime(review.reviewedAt)}
                {review.comment && <span className="text-muted-foreground">: {review.comment}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default ReportSummary;
