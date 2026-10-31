import { toNumber } from '../05-contract-cascading/measurement.js';
import { isFullYear } from '../06-reporting-periods/period.rules.js';
import { calculateContractScore } from '../07-performance-scoring/rules/contractScore.rules.js';

/**
 * Module 11 — How saved results are read on a dashboard. Pure functions with no database access.
 * Only approved reports count as official. Missing, pending, returned and rejected results are always told apart,
 * and a missing result is never treated as zero (SRS 12).
 */

const RESULT_STATES = {
  SUBMITTED: 'PENDING',
  UNDER_REVIEW: 'PENDING',
  APPROVED: 'APPROVED',
  REVISION_REQUIRED: 'RETURNED',
  REJECTED: 'REJECTED',
};

const SUBMITTED_STATES = ['PENDING', 'APPROVED'];

/**
 * A report's status as dashboards show it. A draft reads as MISSING, so its progress stays with the office.
 */
export const resultState = (reportStatus) => RESULT_STATES[reportStatus] ?? 'MISSING';

export const isSubmitted = (reportStatus) => SUBMITTED_STATES.includes(resultState(reportStatus));

export const isDue = (assignment, period) => period.isYearEnd || assignment.reportingFrequencyId === period.frequencyId;

/**
 * The row that answers "how did it end up": the year-end one if there is one, otherwise the latest.
 */
export const pickCurrent = (rows) => {
  const byEndDate = [...rows].sort((a, b) => b.reportingPeriod.endDate - a.reportingPeriod.endDate);
  return byEndDate.find((row) => row.reportingPeriod.isYearEnd) ?? byEndDate[0] ?? null;
};

/**
 * A summed KPI before year end holds a running total, so being below the annual target is normal.
 */
export const isRunningTotal = (kpi, period, fiscalYear) => kpi.periodRollupMethod === 'SUM' && !isFullYear(period, fiscalYear);

const OUTCOME_BY_STATUS = { ABOVE_TARGET: 'EXCEEDING', AT_TARGET: 'MEETING', BELOW_TARGET: 'BELOW', NOT_REPORTED: 'NOT_REPORTED' };
const OUTCOME_BY_STATE = { PENDING: 'PENDING', RETURNED: 'RETURNED', REJECTED: 'REJECTED' };

/**
 * Where one KPI stands. official is its current approved achievement; latestState the state of its newest result.
 */
export const classifyOutcome = ({ official, latestState }) => {
  if (!official) return OUTCOME_BY_STATE[latestState] ?? 'NOT_REPORTED';
  if (official.isRunningTotal) return 'IN_PROGRESS';
  return OUTCOME_BY_STATUS[official.achievementStatus] ?? 'NOT_CALCULABLE';
};

const SUMMARY_KEYS = {
  EXCEEDING: 'exceeding',
  MEETING: 'meeting',
  BELOW: 'below',
  IN_PROGRESS: 'inProgress',
  NOT_REPORTED: 'notReported',
  PENDING: 'pending',
  RETURNED: 'returned',
  REJECTED: 'rejected',
  NOT_CALCULABLE: 'notCalculable',
};

export const summarize = (lines) => {
  const summary = { total: lines.length, ...Object.fromEntries(Object.values(SUMMARY_KEYS).map((key) => [key, 0])) };
  for (const line of lines) summary[SUMMARY_KEYS[line.outcome]] += 1;
  return summary;
};

/**
 * A saved contract score with the university's official basis applied.
 */
export const formatScore = (row) => {
  if (!row) return null;
  const improvement = toNumber(row.weightedImprovementScore);
  const target = toNumber(row.weightedTargetScore);
  return {
    reportingPeriod: row.reportingPeriod,
    officialScore: row.officialBasis === 'IMPROVEMENT' ? improvement : target,
    officialBasis: row.officialBasis,
    weightedImprovementScore: improvement,
    weightedTargetScore: target,
    totalWeight: toNumber(row.totalWeight),
    reportedWeight: toNumber(row.reportedWeight),
    isProvisional: row.isProvisional,
  };
};

const scoreOfficialLines = (lines) =>
  calculateContractScore(
    lines.map((line) => ({
      weight: line.weight,
      improvementAchievementCapped: line.official?.improvementAchievementCapped ?? null,
      targetAchievementCapped: line.official?.targetAchievementCapped ?? null,
      achievementStatus: line.official?.achievementStatus ?? 'NOT_REPORTED',
    })),
    { isProvisional: true }
  );

/**
 * Scores per strategic objective, using each KPI's own weight. Only official achievements are scored.
 */
export const groupByObjective = (lines) => {
  const groups = new Map();
  for (const line of lines) {
    const { strategicObjective } = line.kpi;
    if (!groups.has(strategicObjective.id)) groups.set(strategicObjective.id, { strategicObjective, lines: [] });
    groups.get(strategicObjective.id).lines.push(line);
  }
  return [...groups.values()]
    .map((group) => {
      const { totalWeight, reportedWeight, weightedImprovementScore, weightedTargetScore } = scoreOfficialLines(group.lines);
      return { strategicObjective: group.strategicObjective, summary: summarize(group.lines), totalWeight, reportedWeight, weightedImprovementScore, weightedTargetScore };
    })
    .sort((a, b) => a.strategicObjective.code.localeCompare(b.strategicObjective.code));
};

/**
 * Best official score first. Offices with no official score are listed last rather than treated as zero.
 */
export const compareOffices = (rows) => {
  const scoreOf = (row) => row.score?.officialScore ?? null;
  return [...rows].sort((a, b) => {
    const missing = (scoreOf(a) === null) - (scoreOf(b) === null);
    if (missing !== 0) return missing;
    return scoreOf(b) - scoreOf(a) || a.office.name.localeCompare(b.office.name);
  });
};

/**
 * Whether a report is late. A submitted report never is, whatever the date.
 */
export const isOverdue = (period, reportStatus, today) => !isSubmitted(reportStatus) && Boolean(period.submissionDeadline) && today > period.submissionDeadline;

/**
 * Whether results entered for a report have their proof, counted by verification status.
 */
export const countEvidence = (values) => {
  const reported = values.filter((value) => value.reportingStatus === 'REPORTED');
  const documents = reported.flatMap((value) => value.evidence);
  const countOf = (status) => documents.filter((document) => document.verificationStatus === status).length;
  return {
    results: reported.length,
    withoutEvidence: reported.filter((value) => value.evidence.length === 0).length,
    verified: countOf('VERIFIED'),
    pending: countOf('PENDING'),
    rejected: countOf('REJECTED'),
  };
};

export default { resultState, isSubmitted, isDue, pickCurrent, isRunningTotal, classifyOutcome, summarize, formatScore, groupByObjective, compareOffices, isOverdue, countEvidence };
