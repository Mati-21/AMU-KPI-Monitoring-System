import { prisma } from '../../../config/database.js';
import { toNumber } from '../../05-contract-cascading/measurement.js';
import { APPROVED_STATUSES } from '../../05-contract-cascading/contract.shared.js';
import { addDays } from '../../06-reporting-periods/period.rules.js';
import { aggregateOffices, combineDirectAndAggregated, rollUpPeriods } from '../rules/aggregation.rules.js';

/**
 * Module 07 — Where a KPI's result comes from for one period:
 *  - the office's own figure (DIRECT), plus what its subordinate offices achieved (AGGREGATED), giving the TOTAL;
 *  - or, in a longer period such as the year end, the approved totals of the shorter periods inside it.
 * Only approved results of other reports count. Nothing here writes to the database.
 */

const REPORT_READY = { status: 'APPROVED' };

export const LINE_INCLUDE = {
  kpi: { include: { scale: { include: { levels: { orderBy: { sortOrder: 'asc' } } } }, unit: true, currency: true } },
  contract: { select: { id: true, officeId: true, office: { select: { id: true, name: true, code: true } } } },
  baselines: { include: { effectiveFromPeriod: { select: { startDate: true } } }, orderBy: { versionNo: 'desc' } },
  targets: { include: { effectiveFromPeriod: { select: { startDate: true } } }, orderBy: { versionNo: 'desc' } },
  weights: { orderBy: { versionNo: 'desc' } },
  allocationsGiven: { where: { allocationType: 'RETAINED' }, select: { allocatedAmount: true } },
  children: {
    where: { status: { in: APPROVED_STATUSES } },
    select: {
      id: true,
      reportingFrequencyId: true,
      contract: { select: { office: { select: { id: true, name: true, code: true } } } },
      weights: { where: { isCurrent: true }, take: 1, select: { weight: true } },
    },
  },
};

/**
 * The assignments a report covers: those reported in this period, plus everything else at the year end.
 */
export const dueAssignments = (contractId, period) =>
  prisma.kpiAssignment.findMany({
    where: {
      contractId,
      status: { in: APPROVED_STATUSES },
      ...(period.isYearEnd ? {} : { reportingFrequencyId: period.frequencyId }),
    },
    include: LINE_INCLUDE,
    orderBy: { kpi: { code: 'asc' } },
  });

export const isDirectEntry = (assignment, period) => assignment.reportingFrequencyId === period.frequencyId;

/**
 * The version in force for a period: the newest one that applies from this period or earlier.
 */
export const versionFor = (versions, period) =>
  versions.find((version) => !version.effectiveFromPeriod || version.effectiveFromPeriod.startDate <= period.startDate) ?? versions[versions.length - 1];

/**
 * A stored value as a result, using the converted amount for money so currencies are never mixed.
 */
export const toResult = (row) => {
  if (!row || row.reportingStatus === 'NOT_REPORTED') return null;
  return {
    value: toNumber(row.convertedValue) ?? toNumber(row.value),
    numerator: toNumber(row.numerator),
    denominator: toNumber(row.denominator),
    scaleLevelId: row.scaleLevelId,
  };
};

/**
 * Approved totals of one assignment for its own periods inside a date window, earliest first.
 */
const approvedTotalsInWindow = async (assignmentId, frequencyId, startDate, endDate) => {
  const rows = await prisma.performanceValue.findMany({
    where: {
      assignmentId,
      contributionType: 'TOTAL',
      report: { ...REPORT_READY, reportingPeriod: { frequencyId, startDate: { gte: startDate }, endDate: { lte: endDate } } },
    },
    include: { report: { select: { reportingPeriod: { select: { endDate: true } } } } },
  });
  return rows.sort((a, b) => a.report.reportingPeriod.endDate - b.report.reportingPeriod.endDate);
};

const periodCountInWindow = (fiscalYearId, frequencyId, startDate, endDate) =>
  prisma.reportingPeriod.count({ where: { fiscalYearId, frequencyId, startDate: { gte: startDate }, endDate: { lte: endDate } } });

/**
 * What one subordinate office achieved within the window, ready for aggregation.
 */
const childResult = async (child, kpi, period) => {
  const rows = await approvedTotalsInWindow(child.id, child.reportingFrequencyId, period.startDate, period.endDate);
  const expected = await periodCountInWindow(period.fiscalYearId, child.reportingFrequencyId, period.startDate, period.endDate);
  const latest = await prisma.kpiAchievement.findFirst({
    where: { assignmentId: child.id, reportingPeriod: { startDate: { gte: period.startDate }, endDate: { lte: period.endDate } } },
    orderBy: { reportingPeriod: { endDate: 'desc' } },
    select: { targetMet: true, targetAchievementCapped: true },
  });
  return {
    assignmentId: child.id,
    office: child.contract.office,
    result: rollUpPeriods(kpi, rows.map(toResult)),
    isComplete: expected > 0 && rows.length >= expected,
    targetMet: latest?.targetMet ?? null,
    targetAchievement: toNumber(latest?.targetAchievementCapped),
    weight: toNumber(child.weights[0]?.weight) ?? 0,
  };
};

/**
 * Result of a KPI measured by shorter periods, for a longer period.
 */
const resolveFromShorterPeriods = async (assignment, period) => {
  const rows = await approvedTotalsInWindow(assignment.id, assignment.reportingFrequencyId, period.startDate, period.endDate);
  const expected = await periodCountInWindow(period.fiscalYearId, assignment.reportingFrequencyId, period.startDate, period.endDate);
  return {
    direct: null,
    aggregated: { kind: 'NONE' },
    children: [],
    total: rollUpPeriods(assignment.kpi, rows.map(toResult)),
    scorePercent: null,
    isComplete: expected > 0 && rows.length >= expected,
  };
};

/**
 * Result of a KPI reported in this very period: own figure plus subordinate offices.
 * directRow is the office's DIRECT value on this report, if any.
 */
const resolveFromOfficeWork = async (assignment, period, directRow) => {
  const direct = toResult(directRow);
  const children = await Promise.all(assignment.children.map((child) => childResult(child, assignment.kpi, period)));
  const aggregated = aggregateOffices(assignment.kpi, children);
  const total = combineDirectAndAggregated(assignment.kpi, assignment.scopeRelation, direct, aggregated);
  const scorePercent = aggregated.kind === 'SCORE' ? aggregated.scorePercent : null;

  const retainsWork = assignment.allocationsGiven.some((row) => toNumber(row.allocatedAmount) > 0);
  const needsOwnFigure = children.length === 0 || retainsWork || assignment.scopeRelation !== 'EXCLUSIVE_COMPLETE';
  return {
    direct,
    aggregated,
    children,
    total: scorePercent === null ? total : null,
    scorePercent,
    isComplete: children.every((child) => child.isComplete) && (!needsOwnFigure || Boolean(direct) || scorePercent !== null),
  };
};

export const resolveResult = (assignment, period, directRow) =>
  isDirectEntry(assignment, period) ? resolveFromOfficeWork(assignment, period, directRow) : resolveFromShorterPeriods(assignment, period);

/**
 * The figure judged against the annual target: earlier approved periods of the year plus this period's fresh total.
 * This period's stored row is never reread, because it may be about to be replaced by the total just calculated.
 */
export const resultSoFar = async (assignment, period, fiscalYearStart, currentTotal) => {
  if (!isDirectEntry(assignment, period)) return currentTotal;
  const earlier = await approvedTotalsInWindow(assignment.id, assignment.reportingFrequencyId, fiscalYearStart, addDays(period.startDate, -1));
  return rollUpPeriods(assignment.kpi, [...earlier.map(toResult), currentTotal]);
};

export default { LINE_INCLUDE, dueAssignments, isDirectEntry, versionFor, toResult, resolveResult, resultSoFar };
