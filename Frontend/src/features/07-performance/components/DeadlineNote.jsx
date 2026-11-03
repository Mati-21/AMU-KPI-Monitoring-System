import { formatEthiopianDate as formatDate } from '../../../shared/lib/ethiopianDate';

/**
 * What the deadline means for this period now: late but still accepted, locked (only the Super Admin can allow it),
 * or allowed late until a given day. Nothing is shown before the deadline.
 */
const DeadlineNote = ({ period, deadline, report }) => {
  if (!deadline?.isLate || (report?.status && !['NOT_STARTED', 'DRAFT', 'REVISION_REQUIRED', 'REJECTED'].includes(report.status))) return null;

  if (deadline.isLocked) {
    return (
      <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
        The deadline{deadline.lockedSince ? ` and grace period ended on ${formatDate(deadline.lockedSince)}` : ` passed on ${formatDate(period.submissionDeadline)}`}. Results can still be saved, but only the Super Admin can allow {period.name} to be submitted late.
      </p>
    );
  }
  if (report?.lateAllowedUntil) {
    return (
      <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        Late submission allowed until {formatDate(report.lateAllowedUntil)}
        {report.lateAllowedReason ? `: ${report.lateAllowedReason}` : ''}. It will be marked late.
      </p>
    );
  }
  return <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">Past the deadline: submitting now marks {period.name} late.</p>;
};

export default DeadlineNote;
