/**
 * Module 06 — Date rules for reporting periods. Pure functions with no database access.
 * Dates are UTC calendar dates, as stored in @db.Date columns.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when a period measures the whole fiscal year.
 */
export const isFullYear = (period, fiscalYear) =>
  period.isYearEnd || (period.startDate.getTime() === fiscalYear.startDate.getTime() && period.endDate.getTime() === fiscalYear.endDate.getTime());

export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/**
 * Add months, keeping the day of the month where possible: 31 Jan + 1 month is 28 or 29 Feb.
 */
export const addMonths = (date, months) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDayOfMonth));
  return target;
};

export const defaultDeadline = (endDate, submissionWindowDays) => addDays(endDate, submissionWindowDays);

const PERIOD_PREFIX = { 1: 'Month', 3: 'Q', 6: 'H' };

const periodName = (intervalMonths, number, total) => {
  if (intervalMonths === 12) return 'Annual';
  if (intervalMonths === 3 || intervalMonths === 6) return `${PERIOD_PREFIX[intervalMonths]}${number}`;
  if (intervalMonths === 1) return `${PERIOD_PREFIX[1]} ${number}`;
  return `Period ${number} of ${total}`;
};

/**
 * Split a fiscal year into consecutive periods of intervalMonths. The last period ends on the year's last day.
 * An annual period is the year-end period: its report is the year's final report.
 */
export const buildPeriods = ({ startDate, endDate }, intervalMonths, submissionWindowDays) => {
  const ranges = [];
  for (let start = startDate, index = 1; start <= endDate; index += 1) {
    const nextStart = addMonths(startDate, index * intervalMonths);
    const isLast = addDays(nextStart, -1) >= endDate;
    const end = isLast ? endDate : addDays(nextStart, -1);
    ranges.push({ startDate: start, endDate: end });
    start = nextStart;
    if (isLast) break;
  }
  return ranges.map((range, index) => ({
    ...range,
    name: periodName(intervalMonths, index + 1, ranges.length),
    submissionDeadline: defaultDeadline(range.endDate, submissionWindowDays),
    isYearEnd: intervalMonths === 12,
  }));
};

/**
 * Where a period stands today. Calculated, so it never goes stale.
 */
export const periodPhase = ({ isClosed, startDate, endDate, submissionDeadline }, today) => {
  if (isClosed) return 'CLOSED';
  if (today < startDate) return 'UPCOMING';
  if (today <= endDate) return 'IN_PROGRESS';
  if (!submissionDeadline || today <= submissionDeadline) return 'SUBMISSION_OPEN';
  return 'OVERDUE';
};

export default { addDays, addMonths, defaultDeadline, buildPeriods, periodPhase };
