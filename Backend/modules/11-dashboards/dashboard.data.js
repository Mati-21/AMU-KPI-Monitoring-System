import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { toNumber } from '../05-contract-cascading/measurement.js';
import { APPROVED_STATUSES } from '../05-contract-cascading/contract.shared.js';
import { classifyOutcome, formatScore, isDue, isRunningTotal, pickCurrent, resultState, summarize } from './dashboard.rules.js';

/**
 * Module 11 — What every dashboard reads: the year being viewed, and each office's contract turned into one snapshot
 * of lines, official score and counts. Dashboards only read saved results and never recalculate anything.
 */

const PERIOD_REF = {
  select: { id: true, fiscalYearId: true, frequencyId: true, name: true, startDate: true, endDate: true, submissionDeadline: true, isYearEnd: true, isClosed: true },
};
export const OFFICE_REF = { select: { id: true, name: true, code: true, parentOfficeId: true, officeType: { select: { id: true, name: true, levelOrder: true } } } };

const CONTRACT_INCLUDE = {
  office: OFFICE_REF,
  reports: { select: { id: true, status: true, reportingPeriodId: true, submittedAt: true, reportingPeriod: PERIOD_REF } },
  scores: { include: { reportingPeriod: PERIOD_REF } },
  assignments: {
    where: { status: { in: APPROVED_STATUSES } },
    include: {
      kpi: {
        include: {
          strategicObjective: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
          scale: { include: { levels: { orderBy: { sortOrder: 'asc' } } } },
        },
      },
      weights: { where: { isCurrent: true }, take: 1 },
      baselines: { where: { isCurrent: true }, take: 1 },
      targets: { where: { isCurrent: true }, take: 1 },
      achievements: { include: { reportingPeriod: PERIOD_REF, statusThreshold: { select: { id: true, name: true, color: true } }, weight: { select: { weight: true } } } },
    },
    orderBy: { kpi: { code: 'asc' } },
  },
};

/**
 * The year and optional period being viewed. A period decides its own year; with neither, the active year is used.
 */
export const resolveView = async ({ fiscalYearId, reportingPeriodId } = {}) => {
  const period = reportingPeriodId ? await prisma.reportingPeriod.findUnique({ where: { id: parseUuid(reportingPeriodId, 'reportingPeriodId') }, ...PERIOD_REF }) : null;
  if (reportingPeriodId && !period) throw notFound('Reporting period not found');

  const yearId = fiscalYearId ? parseUuid(fiscalYearId, 'fiscalYearId') : period?.fiscalYearId;
  if (period && yearId !== period.fiscalYearId) throw notFound('That reporting period is not in this fiscal year');

  const fiscalYear = yearId ? await prisma.fiscalYear.findUnique({ where: { id: yearId } }) : await prisma.fiscalYear.findFirst({ where: { status: 'ACTIVE' } });
  if (!fiscalYear) throw notFound(yearId ? 'Fiscal year not found' : 'There is no active fiscal year; choose one');
  return { fiscalYear, period };
};

export const publicView = ({ fiscalYear, period }) => ({ fiscalYear, reportingPeriod: period });

export const assertCanView = async (actor, officeId) => {
  if (!(await actor.access.can(PERMISSIONS.DASHBOARD_READ, officeId))) throw forbidden('You can see dashboards only for offices in your scope');
};

export const findOffice = async (officeId) => {
  const office = await prisma.office.findUnique({ where: { id: parseUuid(officeId, 'officeId') }, ...OFFICE_REF });
  if (!office) throw notFound('Office not found');
  return office;
};

export const loadContracts = (fiscalYearId, officeIds) =>
  prisma.performanceContract.findMany({
    where: { fiscalYearId, ...(officeIds ? { officeId: { in: officeIds } } : {}) },
    include: CONTRACT_INCLUDE,
    orderBy: { versionNo: 'asc' },
  });

/**
 * A stored baseline or target as plain numbers.
 */
export const formatMeasured = (row) =>
  row ? { value: toNumber(row.value), numerator: toNumber(row.numerator), denominator: toNumber(row.denominator), scaleLevelId: row.scaleLevelId } : null;

const formatAchievement = (row, kpi, fiscalYear) => ({
  reportingPeriod: row.reportingPeriod,
  actualValue: toNumber(row.actualValue),
  actualNumerator: toNumber(row.actualNumerator),
  actualDenominator: toNumber(row.actualDenominator),
  actualScaleLevelId: row.actualScaleLevelId,
  requiredImprovement: toNumber(row.requiredImprovement),
  actualImprovement: toNumber(row.actualImprovement),
  improvementAchievementRaw: toNumber(row.improvementAchievementRaw),
  improvementAchievementCapped: toNumber(row.improvementAchievementCapped),
  targetAchievementRaw: toNumber(row.targetAchievementRaw),
  targetAchievementCapped: toNumber(row.targetAchievementCapped),
  notCalculableReason: row.notCalculableReason,
  targetMet: row.targetMet,
  achievementStatus: row.achievementStatus,
  band: row.statusThreshold,
  isProvisional: row.isProvisional,
  isRunningTotal: isRunningTotal(kpi, row.reportingPeriod, fiscalYear),
});

const buildLine = (assignment, stateOfPeriod, fiscalYear, period) => {
  const { kpi } = assignment;
  const rows = assignment.achievements.filter((row) => (!period || row.reportingPeriodId === period.id) && stateOfPeriod(row.reportingPeriodId) !== 'MISSING');
  const officialRow = pickCurrent(rows.filter((row) => stateOfPeriod(row.reportingPeriodId) === 'APPROVED'));
  const latestRow = pickCurrent(rows);
  const official = officialRow ? formatAchievement(officialRow, kpi, fiscalYear) : null;
  const latestState = latestRow ? stateOfPeriod(latestRow.reportingPeriodId) : 'MISSING';
  return {
    assignment,
    assignmentId: assignment.id,
    kpi: { id: kpi.id, code: kpi.code, name: kpi.name, measurementType: kpi.measurementType, direction: kpi.direction, scoringMethod: kpi.scoringMethod, unit: kpi.unit, strategicObjective: kpi.strategicObjective },
    weight: toNumber(officialRow?.weight.weight ?? assignment.weights[0]?.weight ?? 0),
    outcome: classifyOutcome({ official, latestState }),
    official,
    latest: latestRow ? { reportingPeriod: latestRow.reportingPeriod, state: latestState } : null,
  };
};

export const publicLine = ({ assignment: _unused, ...line }) => line;

/**
 * One contract as dashboards see it: the KPI lines, official score, counts, and every saved score as a trend.
 */
export const toSnapshot = (contract, fiscalYear, period = null) => {
  const stateByPeriod = new Map(contract.reports.map((report) => [report.reportingPeriodId, resultState(report.status)]));
  const stateOfPeriod = (periodId) => stateByPeriod.get(periodId) ?? 'MISSING';

  const assignments = period ? contract.assignments.filter((assignment) => isDue(assignment, period)) : contract.assignments;
  const lines = assignments.map((assignment) => buildLine(assignment, stateOfPeriod, fiscalYear, period));
  const approvedScores = contract.scores.filter((row) => stateOfPeriod(row.reportingPeriodId) === 'APPROVED' && (!period || row.reportingPeriodId === period.id));

  const trend = contract.scores
    .filter((row) => stateOfPeriod(row.reportingPeriodId) !== 'MISSING')
    .sort((a, b) => a.reportingPeriod.endDate - b.reportingPeriod.endDate)
    .map((row) => ({ ...formatScore(row), state: stateOfPeriod(row.reportingPeriodId) }));

  return { contract, score: formatScore(pickCurrent(approvedScores)), lines, summary: summarize(lines), trend };
};

/**
 * A short row for lists and comparisons. An office without a contract is shown with empty figures.
 */
export const toOfficeRow = (office, snapshot) => {
  const latest = snapshot ? pickCurrent(snapshot.contract.reports.filter((report) => resultState(report.status) !== 'MISSING')) : null;
  return {
    office,
    contractStatus: snapshot?.contract.status ?? null,
    score: snapshot?.score ?? null,
    summary: snapshot?.summary ?? summarize([]),
    latestReport: latest ? { reportId: latest.id, reportingPeriod: latest.reportingPeriod, state: resultState(latest.status) } : null,
  };
};

/**
 * An office's official score for every year it has a contract, newest first.
 */
export const loadYearHistory = async (officeId) => {
  const contracts = await prisma.performanceContract.findMany({
    where: { officeId },
    include: {
      fiscalYear: { select: { id: true, name: true, status: true, startDate: true } },
      reports: { where: { status: 'APPROVED' }, select: { reportingPeriodId: true } },
      scores: { include: { reportingPeriod: PERIOD_REF } },
    },
  });
  return contracts
    .map((contract) => {
      const approved = new Set(contract.reports.map((report) => report.reportingPeriodId));
      return { fiscalYear: contract.fiscalYear, score: formatScore(pickCurrent(contract.scores.filter((row) => approved.has(row.reportingPeriodId)))) };
    })
    .sort((a, b) => b.fiscalYear.startDate - a.fiscalYear.startDate);
};

export default { resolveView, publicView, assertCanView, findOffice, loadContracts, formatMeasured, publicLine, toSnapshot, toOfficeRow, loadYearHistory };
