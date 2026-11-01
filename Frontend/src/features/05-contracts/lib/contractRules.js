import { optionLabel } from '../../10-system/lib/settingValues';

const BASELINE_WORDS = { UNKNOWN: 'Unknown', PENDING_VERIFICATION: 'Pending verification' };

export const BASELINE_OPTIONS = [
  { value: 'KNOWN', label: 'Known value' },
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
];

export const SCOPE_OPTIONS = [
  { value: 'EXCLUSIVE_COMPLETE', label: 'Split between offices below (their parts add up to this)' },
  { value: 'OVERLAPPING', label: 'Shared with offices below (each works on the same result)' },
  { value: 'INSTITUTION_WIDE', label: 'Whole institution (one result for everyone)' },
];

const APPROVED_STATUSES = ['APPROVED', 'ACKNOWLEDGED'];
const STATUS_WORDS = { SUBMITTED: 'Awaiting signature', ACKNOWLEDGED: 'Accepted' };

// Reddish, for rows that were rejected and are waiting for the office above
export const REJECTED_ROW = 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50';
const OPEN_STATUSES = ['DRAFT', 'REJECTED'];

export const isOpen = (record) => OPEN_STATUSES.includes(record.status);
export const isApproved = (assignment) => APPROVED_STATUSES.includes(assignment.status);
export const rejectedRow = (record) => (record.status === 'REJECTED' ? REJECTED_ROW : '');
export const isFlagged = (assignment) => assignment.status !== 'CANCELLED' && Boolean(assignment.reviewComment);
export const flaggedCount = (contract) => contract.assignments.filter(isFlagged).length;
export const statusLabel = (status) => STATUS_WORDS[status] ?? optionLabel(status);
export const usesLevels = (kpi) => kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY';

const isFraction = (kpi) => kpi.measurementType === 'PERCENTAGE' || kpi.measurementType === 'RATIO';
const onlyLive = (contract) => contract.assignments.filter((assignment) => assignment.status !== 'CANCELLED');

/**
 * What has to happen next on a contract, in plain words.
 */
export const nextStep = (contract) => {
  const issuer = contract.assigningOffice?.name ?? 'The university';
  if (contract.status === 'SUBMITTED') return flaggedCount(contract) > 0 ? `${flaggedCount(contract)} KPI(s) flagged. ${contract.office.name} rejects the contract, or removes the flags to sign it.` : `${contract.office.name} reviews it, then accepts and signs it, or flags KPIs and rejects it.`;
  if (contract.status === 'SIGNED') return 'This contract is signed. Its KPIs can now pass down to the offices below.';
  if (contract.status === 'REJECTED') return `${issuer} corrects the contract and assigns it again.`;
  if (contract.status !== 'DRAFT') return '';
  if (onlyLive(contract).length === 0) return `${issuer} adds the KPIs of this contract.`;
  if (!contract.isWeightBalanced) return `Make the weights total ${contract.requiredTotalWeight}. They now total ${contract.totalWeight}.`;
  return `${issuer} assigns the contract to ${contract.office.name}.`;
};

// Levels come from dropdowns, which a browser's required check cannot cover
export const hasLevels = (kpi, form) => !usesLevels(kpi) || Boolean(form.target.scaleLevelId && (form.baselineStatus !== 'KNOWN' || form.baseline.scaleLevelId));

/**
 * Why a selected KPI cannot go on this contract, or null when it can.
 */
export const blockedReason = (contract, kpi) => {
  if (onlyLive(contract).some((assignment) => assignment.kpi.id === kpi.id)) return 'Already on this contract.';
  if (!kpi.isActive) return 'This KPI is retired.';
  return contract.assigningOfficeId ? `${contract.assigningOffice.name} has not signed this KPI yet.` : null;
};

/**
 * A baseline or target as people read it, following the KPI's measurement type.
 */
export const measureText = (kpi, row) => {
  if (!row) return '-';
  if (BASELINE_WORDS[row.baselineStatus]) return BASELINE_WORDS[row.baselineStatus];
  if (row.scaleLevel) return row.scaleLevel.name;
  if (row.value === null || row.value === undefined) return '-';

  const value = Number(row.value);
  if (kpi.measurementType === 'PERCENTAGE') return `${value}%`;
  if (kpi.measurementType === 'MONEY') return `${value} ${kpi.currency?.code ?? ''}`.trim();
  return `${value} ${kpi.unit?.symbol ?? ''}`.trim();
};

/**
 * Offices that can get a contract this year: active, without one yet, and with a parent that may assign KPIs.
 * The top office has no parent, so it always qualifies.
 */
export const contractOfficeOptions = (offices, contracts) => {
  const taken = new Set(contracts.map((contract) => contract.officeId));
  const byId = new Map(offices.map((office) => [office.id, office]));
  return offices
    .filter((office) => office.isActive && !taken.has(office.id))
    .filter((office) => !office.parentOfficeId || byId.get(office.parentOfficeId)?.canAssignKpi)
    .map((office) => ({ value: office.id, label: office.name }));
};

/**
 * What can still be added to a contract: for the top office any active KPI, for the others only what the office
 * directly above already has approved. Each choice remembers the assignment it cascades from.
 */
export const assignableKpis = (contract, kpis, parentContract) => {
  const taken = new Set(onlyLive(contract).map((assignment) => assignment.kpi.id));
  if (!contract.assigningOfficeId) return kpis.filter((kpi) => kpi.isActive && !taken.has(kpi.id)).map((kpi) => ({ kpi, parent: null }));

  const byId = new Map(kpis.map((kpi) => [kpi.id, kpi]));
  return (parentContract?.assignments ?? [])
    .filter((parent) => APPROVED_STATUSES.includes(parent.status) && !taken.has(parent.kpi.id) && byId.get(parent.kpi.id)?.isActive)
    .map((parent) => ({ kpi: byId.get(parent.kpi.id), parent }));
};

/**
 * An amount split evenly to two decimals. The last office takes the rounding, so the parts add up exactly.
 */
export const equalShares = (total, count) => {
  if (count === 0) return [];
  const each = Math.floor((total / count) * 100) / 100;
  const last = Math.round((total - each * (count - 1)) * 10000) / 10000;
  return [...Array(count - 1).fill(each), last];
};

// What this office was given of the KPI above it, if that KPI is shared
export const shareFor = (parent, officeId) => parent?.sharing?.offices?.find((line) => line.office.id === officeId)?.amount ?? null;

const targetFromShare = (kpi, baseline, share) => String(Math.round((kpi.direction === 'LOWER_IS_BETTER' ? Number(baseline) - share : Number(baseline) + share) * 10000) / 10000);

/**
 * Typing a baseline fills in the target that delivers the office's share.
 */
export const withShareTarget = (kpi, share, before, next) => {
  if (share === null || next.baselineStatus !== 'KNOWN' || next.baseline.value === '' || next.baseline.value === before.baseline.value) return next;
  return { ...next, target: { ...next.target, value: targetFromShare(kpi, next.baseline.value, share) } };
};

const text = (value) => (value === null || value === undefined ? '' : String(Number(value)));

const startMeasure = (row) => ({ value: text(row?.value), numerator: text(row?.numerator), denominator: text(row?.denominator), scaleLevelId: row?.scaleLevelId ?? '' });

export const defaultsForKpi = (kpi, parent) => ({
  reportingFrequencyId: parent?.reportingFrequencyId ?? kpi?.defaultFrequencyId ?? '',
  scopeRelation: kpi?.isAdditive ? 'EXCLUSIVE_COMPLETE' : 'OVERLAPPING',
  baselineStatus: 'KNOWN',
  justification: '',
  baseline: startMeasure(),
  target: startMeasure(),
  weight: '',
});

export const formFromAssignment = (assignment) => ({
  reportingFrequencyId: assignment.reportingFrequencyId,
  scopeRelation: assignment.scopeRelation,
  baselineStatus: assignment.baseline.baselineStatus === 'VERIFIED' ? 'KNOWN' : assignment.baseline.baselineStatus,
  justification: assignment.baseline.unknownJustification ?? '',
  baseline: startMeasure(assignment.baseline),
  target: startMeasure(assignment.target),
  weight: text(assignment.weight),
});

// Baselines of percentages and ratios need both parts, while a target may be just the percentage or ratio
const measurePayload = (kpi, measure, useParts) => {
  if (usesLevels(kpi)) return { scaleLevelId: measure.scaleLevelId };
  if (isFraction(kpi) && useParts) return { numerator: Number(measure.numerator), denominator: Number(measure.denominator) };
  return { value: Number(measure.value) };
};

const baselinePayload = (kpi, form) =>
  form.baselineStatus === 'KNOWN' ? { status: 'KNOWN', ...measurePayload(kpi, form.baseline, true) } : { status: form.baselineStatus, justification: form.justification };

export const assignmentPayload = (kpi, form) => ({
  reportingFrequencyId: form.reportingFrequencyId,
  scopeRelation: form.scopeRelation,
  baseline: baselinePayload(kpi, form),
  target: measurePayload(kpi, form.target, false),
  weight: Number(form.weight),
});

/**
 * Only what changed, because saving a baseline again sends it back to unverified.
 */
export const changedPayload = (kpi, form, start) => {
  const before = assignmentPayload(kpi, start);
  return Object.fromEntries(Object.entries(assignmentPayload(kpi, form)).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])));
};

/**
 * The percentage or ratio a baseline's two parts come to, or null until they can be worked out.
 */
export const fractionPreview = (kpi, { numerator, denominator }) => {
  if (!isFraction(kpi) || numerator === '' || !Number(denominator)) return null;
  const ratio = Number(numerator) / Number(denominator);
  return kpi.measurementType === 'PERCENTAGE' ? `${Math.round(ratio * 10000) / 100}%` : String(Math.round(ratio * 10000) / 10000);
};
