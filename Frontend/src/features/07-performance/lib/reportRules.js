import { optionLabel } from '../../10-system/lib/settingValues';

const STATUS_WORDS = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  REVISION_REQUIRED: 'Revision required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OVERDUE: 'Overdue',
};

const STATUS_TONES = {
  NOT_STARTED: 'bg-muted text-foreground',
  DRAFT: 'bg-muted text-foreground',
  SUBMITTED: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  UNDER_REVIEW: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  REVISION_REQUIRED: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  REJECTED: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200',
  APPROVED: 'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200',
};

export const EVIDENCE_WORDS = { PENDING: 'Waiting for verification', VERIFIED: 'Verified', REJECTED: 'Rejected' };

export const REVIEW_DECISIONS = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REVISION_REQUIRED', label: 'Ask for revision' },
  { value: 'REJECTED', label: 'Reject' },
];

export const reportStatusLabel = (status) => STATUS_WORDS[status] ?? optionLabel(status);
export const reportStatusTone = (status) => STATUS_TONES[status] ?? STATUS_TONES.DRAFT;

export const usesLevels = (kpi) => kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY';
export const isFraction = (kpi) => kpi.measurementType === 'PERCENTAGE' || kpi.measurementType === 'RATIO';

const round = (value) => Math.round(value * 10000) / 10000;
const filled = (value) => value !== null && value !== undefined && value !== '';

/**
 * A number in the KPI's unit: "350000 ETB", "65%", "12 #". Without the unit ("350000", "65") where a table already
 * has a Unit column.
 */
export const amountText = (kpi, value, withUnit = true) => {
  if (!filled(value)) return '-';
  const number = round(Number(value));
  if (kpi.measurementType === 'PERCENTAGE') {
    const percent = Math.round(Number(value) * 100) / 100;
    return withUnit ? `${percent}%` : String(percent);
  }
  if (!withUnit) return String(number);
  if (kpi.measurementType === 'MONEY') return `${number} ${kpi.currency?.code ?? ''}`.trim();
  if (kpi.measurementType === 'RATIO') return String(number);
  return `${number} ${kpi.unit?.symbol ?? ''}`.trim();
};

/**
 * A baseline, target or result as words. Works for stored rows and calculated results alike.
 * `withUnit` false leaves the unit out, for tables with a Unit column.
 */
export const resultText = (kpi, row, withUnit = true) => {
  if (!row) return '-';
  if (row.reportingStatus === 'NOT_REPORTED') return 'Not reported';
  if (row.baselineStatus && row.baselineStatus !== 'KNOWN') return optionLabel(row.baselineStatus);
  if (row.scaleLevelId) return kpi.levels.find((level) => level.id === row.scaleLevelId)?.name ?? '-';
  if (isFraction(kpi) && filled(row.numerator) && Number(row.denominator)) {
    const ratio = Number(row.numerator) / Number(row.denominator);
    return `${amountText(kpi, kpi.measurementType === 'PERCENTAGE' ? ratio * 100 : ratio, withUnit)} (${round(Number(row.numerator))} of ${round(Number(row.denominator))})`;
  }
  return amountText(kpi, row.convertedValue ?? row.value, withUnit);
};

/**
 * The form for one KPI line, from what was saved before.
 */
export const entryFromLine = (line) => {
  const row = line.direct;
  const text = (value) => (filled(value) ? String(Number(value)) : '');
  return {
    reportingStatus: row?.reportingStatus === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'REPORTED',
    value: text(row?.value),
    numerator: text(row?.numerator),
    denominator: text(row?.denominator),
    scaleLevelId: row?.scaleLevelId ?? '',
    note: row?.note ?? '',
  };
};

/**
 * Whether a line has something to save: a stated "not reported", or the fields its measurement type needs.
 */
export const isEntryComplete = (kpi, entry) => {
  if (entry.reportingStatus === 'NOT_REPORTED') return true;
  if (usesLevels(kpi)) return Boolean(entry.scaleLevelId);
  if (isFraction(kpi)) return filled(entry.numerator) && Number(entry.denominator) > 0;
  return filled(entry.value);
};

export const entryPayload = (line, entry) => {
  const base = { assignmentId: line.assignmentId, reportingStatus: entry.reportingStatus, note: entry.note.trim() || undefined };
  if (entry.reportingStatus === 'NOT_REPORTED') return base;
  if (usesLevels(line.kpi)) return { ...base, scaleLevelId: entry.scaleLevelId };
  if (isFraction(line.kpi)) return { ...base, numerator: Number(entry.numerator), denominator: Number(entry.denominator) };
  return { ...base, value: Number(entry.value) };
};

export const entryChanged = (line, entry) => JSON.stringify(entryFromLine(line)) !== JSON.stringify(entry);

/**
 * How far the result reaches the target, as a percentage, or why it cannot be worked out yet.
 */
export const achievementOf = (line) => {
  const percent = line.achievement?.targetAchievementCapped;
  if (percent !== null && percent !== undefined) return { percent: round(Number(percent)), threshold: line.threshold };
  return { percent: null, reason: line.achievement?.notCalculableReason ?? (line.isComplete ? null : 'Waiting for results') };
};
