import { optionLabel } from '../../10-system/lib/settingValues';

const BASELINE_WORDS = { UNKNOWN: 'Unknown', PENDING_VERIFICATION: 'Pending verification' };

export const BASELINE_OPTIONS = [
  { value: 'KNOWN', label: 'Known value' },
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
];

export const SHARE_METHOD_WORDS = { EQUAL: 'Equally', FULL: 'Fully', CUSTOM: 'Custom' };

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
  if (!contract.assigningOfficeId) return `${contract.office.name} approves and signs its self contract.`;
  return `${issuer} assigns the contract to ${contract.office.name}.`;
};

// Shared equally or fully, the server works the target out, so none is sent
const targetIsWorkedOut = (form) => form.shareMethod === 'EQUAL' || form.shareMethod === 'FULL';

// Levels come from dropdowns, which a browser's required check cannot cover
export const hasLevels = (kpi, form) => !usesLevels(kpi) || Boolean((targetIsWorkedOut(form) || form.target.scaleLevelId) && (form.baselineStatus !== 'KNOWN' || form.baseline.scaleLevelId));

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
 * Offices that can get a contract this year: those the server offers (directly below the person's own office, or
 * their own top office) that have no contract yet.
 */
export const contractOfficeOptions = (offices, contracts) => {
  const taken = new Set(contracts.map((contract) => contract.officeId));
  return offices.filter((office) => !taken.has(office.id)).map((office) => ({ value: office.id, label: office.name }));
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

/**
 * The most an office can be given of a divided KPI: what remains, plus what it already holds on its contract.
 */
export const mostFor = (sharing, officeId) => {
  const held = sharing.offices.find((line) => line.office.id === officeId && line.assignmentId)?.amount ?? 0;
  return Math.max(0, Math.round((sharing.parentAmount - sharing.assigned + held) * 10000) / 10000);
};

const round4 = (value) => Math.round(value * 10000) / 10000;

/**
 * The ways the KPI above can be shared for an office below. Once a contract holding it was sent, only the way it was
 * sent. Equally needs a number or money KPI with an improvement and offices to divide it between.
 */
export const shareMethodOptions = (sharing) => {
  if (!sharing) return [];
  if (sharing.locked) return [{ value: sharing.method, label: SHARE_METHOD_WORDS[sharing.method] }];
  const canDivide = sharing.divisible && sharing.parentAmount > 0 && sharing.officesBelow.length > 0;
  return [
    ...(canDivide ? [{ value: 'EQUAL', label: `Equally - the improvement divided between the ${sharing.officesBelow.length} offices below` }] : []),
    { value: 'FULL', label: 'Fully - every office below gets the whole improvement' },
    { value: 'CUSTOM', label: 'Custom - set the target yourself' },
  ];
};

export const equalAmountFor = (sharing, officeId) => {
  if (sharing.equalAmounts?.[officeId] !== undefined) return sharing.equalAmounts[officeId];
  const index = sharing.officesBelow.findIndex((office) => office.id === officeId);
  return index < 0 ? null : equalShares(sharing.parentAmount, sharing.officesBelow.length)[index];
};

const baselineNumber = (kpi, form) => {
  if (form.baselineStatus !== 'KNOWN') return null;
  if (isFraction(kpi)) {
    if (form.baseline.numerator === '' || !Number(form.baseline.denominator)) return null;
    const ratio = Number(form.baseline.numerator) / Number(form.baseline.denominator);
    return kpi.measurementType === 'PERCENTAGE' ? ratio * 100 : ratio;
  }
  return form.baseline.value === '' ? null : Number(form.baseline.value);
};

/**
 * The target an office gets when the KPI above is shared equally or fully, worked out as the server does: its own
 * baseline moved by its share, or the same target as above where no improvement can be worked out.
 * Null for Custom, where the target is entered.
 */
export const sharedTarget = (kpi, parent, method, form, officeId) => {
  if (!parent?.sharing || !method || method === 'CUSTOM') return null;
  const { sharing } = parent;
  const sameAsAbove = usesLevels(kpi) || kpi.direction === 'MAINTAIN' || sharing.parentAmount === null || form.baselineStatus !== 'KNOWN';
  if (sameAsAbove) return method === 'FULL' ? { text: `${measureText(kpi, parent.target)}, the same as the office above` } : { problem: 'Sharing equally needs a known baseline, because the target is the baseline plus the share.' };

  const amount = method === 'EQUAL' ? equalAmountFor(sharing, officeId) : sharing.parentAmount;
  if (amount === null) return { problem: 'This office is not an active office directly below, so it has no equal share.' };
  const lower = kpi.direction === 'LOWER_IS_BETTER';
  const share = measureText(kpi, { value: amount });
  const start = baselineNumber(kpi, form);
  if (start === null) return { text: `Your baseline ${lower ? 'minus' : 'plus'} ${share}`, amount };
  const value = round4(lower ? start - amount : start + amount);
  if (value < 0) return { problem: `Starting from ${round4(start)}, a reduction of ${amount} would go below zero.` };
  return { text: `${measureText(kpi, { value })} (baseline ${measureText(kpi, { value: round4(start) })} ${lower ? '-' : '+'} share ${share})`, amount, value };
};

/**
 * An office reports a KPI as often as the office above, or more often. Custom periods only follow Custom.
 */
export const frequencyChoices = (usable, frequencies, aboveFrequencyId) => {
  if (!aboveFrequencyId) return usable;
  const above = frequencies.find((frequency) => frequency.id === aboveFrequencyId);
  return usable.filter((frequency) => frequency.id === aboveFrequencyId || (above?.intervalMonths && frequency.intervalMonths && frequency.intervalMonths < above.intervalMonths));
};

const text = (value) => (value === null || value === undefined ? '' : String(Number(value)));

const startMeasure = (row) => ({ value: text(row?.value), numerator: text(row?.numerator), denominator: text(row?.denominator), scaleLevelId: row?.scaleLevelId ?? '' });

// Below the top office the KPI starts from the way the office above already shares it, if it chose one
export const defaultsForKpi = (kpi, parent) => ({
  reportingFrequencyId: parent?.reportingFrequencyId ?? kpi?.defaultFrequencyId ?? '',
  ...(parent && { shareMethod: parent.sharing?.method ?? '' }),
  baselineStatus: 'KNOWN',
  justification: '',
  baseline: startMeasure(),
  target: startMeasure(),
  weight: '',
});

export const formFromAssignment = (assignment, parent) => ({
  reportingFrequencyId: assignment.reportingFrequencyId,
  ...(parent && { shareMethod: parent.sharing?.method ?? 'CUSTOM' }),
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
  ...(form.shareMethod !== undefined && { shareMethod: form.shareMethod }),
  baseline: baselinePayload(kpi, form),
  ...(!targetIsWorkedOut(form) && { target: measurePayload(kpi, form.target, false) }),
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
