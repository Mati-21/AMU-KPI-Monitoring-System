import { prisma } from '../../../config/database.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { toNumber } from '../../05-contract-cascading/measurement.js';
import { isFullYear } from '../../06-reporting-periods/period.rules.js';
import { getSetting } from '../../10-system-governance/system.service.js';
import { calculateAchievement, pickThreshold } from '../rules/achievement.rules.js';
import { calculateContractScore } from '../rules/contractScore.rules.js';
import { dueAssignments, isDirectEntry, resolveResult, resultSoFar, versionFor } from './result.service.js';

/**
 * Module 07 — Turns results into achievements and contract scores.
 * buildLines only calculates, so a draft can be previewed. recalculateReport also saves, and then refreshes every
 * report that depends on this one: the same office's year end and the office above.
 */

const REPORT_INCLUDE = {
  contract: { select: { id: true, officeId: true, assigningOfficeId: true, fiscalYearId: true } },
  reportingPeriod: { include: { fiscalYear: { select: { id: true, startDate: true, endDate: true } } } },
};

const STATUSES_THAT_COUNT = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

const loadScoringSettings = async () => {
  const [capOverachievement, maxScorePercent, officialBasis, thresholds] = await Promise.all([
    getSetting('kpi', 'cap_overachievement'),
    getSetting('kpi', 'max_score_percent'),
    getSetting('kpi', 'official_basis'),
    prisma.performanceStatusThreshold.findMany({ where: { isActive: true } }),
  ]);
  return { capOverachievement, maxScorePercent, officialBasis, thresholds };
};

/**
 * Calculate every line of a report without saving anything.
 * Each line holds the assignment, its result and its achievement.
 */
export const buildLines = async (report, settings) => {
  const period = report.reportingPeriod;
  const assignments = await dueAssignments(report.contractId, period);
  const directRows = await prisma.performanceValue.findMany({ where: { reportId: report.id, contributionType: 'DIRECT' } });
  const directByAssignment = new Map(directRows.map((row) => [row.assignmentId, row]));
  const isApproved = report.status === 'APPROVED';
  const fullYear = isFullYear(period, period.fiscalYear);

  return Promise.all(
    assignments.map(async (assignment) => {
      const directRow = directByAssignment.get(assignment.id) ?? null;
      const resolved = await resolveResult(assignment, period, directRow);
      const baseline = versionFor(assignment.baselines, period);
      const target = versionFor(assignment.targets, period);
      const weightRow = assignment.weights[0];
      const weight = toNumber(weightRow.weight);

      const actual = resolved.scorePercent === null ? await resultSoFar(assignment, period, period.fiscalYear.startDate, resolved.total) : null;
      const isInterimSum = !fullYear && assignment.kpi.periodRollupMethod === 'SUM';
      const achievement = calculateAchievement({ kpi: assignment.kpi, baseline, target, weight, actual, scorePercent: resolved.scorePercent, isInterimSum, settings });
      const threshold = pickThreshold(settings.thresholds, assignment.kpi, achievement);

      return {
        assignment,
        directRow,
        resolved,
        actual,
        baseline,
        target,
        weightRow,
        weight,
        achievement,
        threshold,
        isDirectEntry: isDirectEntry(assignment, period),
        // A result is final only once approved, complete, and measured over the whole year
        isProvisional: !isApproved || !resolved.isComplete || !fullYear,
      };
    })
  );
};

const resultColumns = (result) => ({
  value: result?.value ?? null,
  numerator: result?.numerator ?? null,
  denominator: result?.denominator ?? null,
  scaleLevelId: result?.scaleLevelId ?? null,
});

const saveValue = (tx, report, line, contributionType, data) => {
  const where = { reportId_assignmentId_contributionType: { reportId: report.id, assignmentId: line.assignment.id, contributionType } };
  const row = {
    ...data,
    currencyId: line.assignment.kpi.measurementType === 'MONEY' ? line.assignment.kpi.currencyId : null,
  };
  return tx.performanceValue.upsert({ where, update: row, create: { reportId: report.id, assignmentId: line.assignment.id, contributionType, ...row } });
};

const saveCalculatedValues = async (tx, report, line) => {
  const { aggregated, total, scorePercent } = line.resolved;
  if (aggregated.kind === 'VALUE') await saveValue(tx, report, line, 'AGGREGATED', resultColumns(aggregated.result));
  if (scorePercent !== null) await saveValue(tx, report, line, 'AGGREGATED', { ...resultColumns(null), value: scorePercent, note: `Score across offices (${line.assignment.kpi.aggregationMethod})` });

  const hasTotal = Boolean(total) || scorePercent !== null;
  await saveValue(tx, report, line, 'TOTAL', {
    ...(scorePercent !== null ? { ...resultColumns(null), value: scorePercent } : resultColumns(total)),
    reportingStatus: hasTotal ? 'REPORTED' : 'NOT_REPORTED',
  });
};

const saveAchievement = (tx, report, line) => {
  const { actual } = line;
  const data = {
    baselineId: line.baseline.id,
    targetId: line.target.id,
    weightId: line.weightRow.id,
    actualValue: actual?.value ?? null,
    actualNumerator: actual?.numerator ?? null,
    actualDenominator: actual?.denominator ?? null,
    actualScaleLevelId: actual?.scaleLevelId ?? null,
    ...line.achievement,
    statusThresholdId: line.threshold?.id ?? null,
    isProvisional: line.isProvisional,
    calculatedAt: new Date(),
  };
  return tx.kpiAchievement.upsert({
    where: { assignmentId_reportingPeriodId: { assignmentId: line.assignment.id, reportingPeriodId: report.reportingPeriodId } },
    update: data,
    create: { assignmentId: line.assignment.id, reportingPeriodId: report.reportingPeriodId, ...data },
  });
};

const saveContractScore = (tx, report, lines, officialBasis) => {
  const score = calculateContractScore(
    lines.map((line) => ({ weight: line.weight, ...line.achievement })),
    { officialBasis, isProvisional: lines.some((line) => line.isProvisional) }
  );
  const data = { ...score, calculatedAt: new Date() };
  return tx.contractScore.upsert({
    where: { contractId_reportingPeriodId: { contractId: report.contractId, reportingPeriodId: report.reportingPeriodId } },
    update: data,
    create: { contractId: report.contractId, reportingPeriodId: report.reportingPeriodId, ...data },
  });
};

/**
 * Reports whose figures include this report: the same contract's longer periods and the contract of the office above.
 */
const dependentReports = async (report) => {
  const period = report.reportingPeriod;
  const contracts = [report.contractId];
  if (report.contract.assigningOfficeId) {
    const above = await prisma.performanceContract.findFirst({
      where: { fiscalYearId: report.contract.fiscalYearId, officeId: report.contract.assigningOfficeId },
      select: { id: true },
    });
    if (above) contracts.push(above.id);
  }
  return prisma.performanceReport.findMany({
    where: {
      id: { not: report.id },
      contractId: { in: contracts },
      status: { in: STATUSES_THAT_COUNT },
      reportingPeriod: { startDate: { lte: period.startDate }, endDate: { gte: period.endDate } },
    },
    select: { id: true },
  });
};

/**
 * Save a report's calculated values, achievements and contract score, then refresh what depends on it.
 * Saved achievements record the exact baseline, target and weight versions, so results stay traceable (SRS 11.2).
 */
export const recalculateReport = async (reportId, actor, visited = new Set()) => {
  if (visited.has(reportId)) return;
  visited.add(reportId);

  const report = await prisma.performanceReport.findUnique({ where: { id: reportId }, include: REPORT_INCLUDE });
  const settings = await loadScoringSettings();
  const lines = await buildLines(report, settings);

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await saveCalculatedValues(tx, report, line);
      await saveAchievement(tx, report, line);
    }
    await saveContractScore(tx, report, lines, settings.officialBasis);
    await tx.performanceReport.update({ where: { id: report.id }, data: { isProvisional: lines.some((line) => line.isProvisional) } });
  });

  await auditAction(actor, {
    action: 'RESULTS_RECALCULATED',
    entityType: 'performance_report',
    entityId: report.id,
    newValues: { lines: lines.length, status: report.status },
  });

  for (const dependent of await dependentReports(report)) {
    await recalculateReport(dependent.id, actor, visited);
  }
};

/**
 * Lines of a report for reading, calculated fresh so a draft shows its progress too.
 */
export const previewLines = async (report) => buildLines(report, await loadScoringSettings());

/**
 * Approved results below the university's alert level. Judged on the KPI's own scoring method.
 * Running totals are left out: part-way through the year a low figure is normal.
 */
export const findLowResults = async (reportId) => {
  const alertPercent = await getSetting('reporting', 'low_performance_alert_percent');
  if (!alertPercent) return [];
  const rows = await prisma.kpiAchievement.findMany({
    where: { reportingPeriod: { reports: { some: { id: reportId } } }, assignment: { contract: { reports: { some: { id: reportId } } } } },
    include: { assignment: { select: { kpi: { select: { code: true, scoringMethod: true, periodRollupMethod: true } } } }, reportingPeriod: { select: { isYearEnd: true } } },
  });
  return rows
    .filter(({ assignment, reportingPeriod }) => reportingPeriod.isYearEnd || assignment.kpi.periodRollupMethod !== 'SUM')
    .map((row) => ({
      kpiCode: row.assignment.kpi.code,
      percent: toNumber(row.assignment.kpi.scoringMethod === 'IMPROVEMENT' ? (row.improvementAchievementCapped ?? row.targetAchievementCapped) : row.targetAchievementCapped),
    }))
    .filter((row) => row.percent !== null && row.percent < alertPercent);
};

export default { buildLines, recalculateReport, previewLines, findLowResults };
