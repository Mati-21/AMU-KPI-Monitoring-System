import { reportStatusLabel, reportStatusTone } from '../lib/reportRules';

/**
 * A report's status as a coloured badge, with an Overdue mark while it is still waiting past its deadline and a Late
 * mark once it was submitted after it.
 */
const ReportStatus = ({ status, isOverdue, isLate }) => (
  <span className="inline-flex flex-wrap items-center gap-1">
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${reportStatusTone(status)}`}>{reportStatusLabel(status)}</span>
    {isLate && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950/50 dark:text-red-200">Late</span>}
    {isOverdue && <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950/50 dark:text-red-200">Overdue</span>}
  </span>
);

export default ReportStatus;
