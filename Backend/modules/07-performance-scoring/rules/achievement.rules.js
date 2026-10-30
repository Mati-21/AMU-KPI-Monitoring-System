import { numericValue, requiredImprovement, toNumber } from '../../05-contract-cascading/measurement.js';

/**
 * How one KPI's achievement is calculated (SRS 6 and 7). Pure functions with no database access.
 * Improvement achievement and target achievement are separate answers and are always kept separate.
 * Raw values are never altered: negative results and overachievement stay visible, and capping is a separate column.
 */

const round4 = (value) => Math.round(value * 10000) / 10000;
const percent = (part, whole) => round4((part / whole) * 100);

const ORDINAL_TYPES = ['STAGE', 'CATEGORY'];
const isUnscoredScale = (kpi) => ORDINAL_TYPES.includes(kpi.measurementType) && !kpi.scale?.scoringApproved;

const notReported = () => ({
  requiredImprovement: null,
  actualImprovement: null,
  improvementCalculable: false,
  notCalculableReason: 'No result reported',
  improvementAchievementRaw: null,
  targetAchievementRaw: null,
  targetMet: null,
  achievementStatus: 'NOT_REPORTED',
});

// ===== Improvement achievement (SRS 6.1) =====

const improvementFormula = (direction, baseline, target, actual) =>
  direction === 'LOWER_IS_BETTER' ? percent(baseline - actual, baseline - target) : percent(actual - baseline, target - baseline);

const actualImprovementOf = (direction, baseline, actual) => round4(direction === 'LOWER_IS_BETTER' ? baseline - actual : actual - baseline);

const withinTolerance = (actual, target, tolerance) => Math.abs(actual - target) <= tolerance;

/**
 * Returns { raw, reason }. Exactly one is set: why a value is missing is always stated (SRS 6.4).
 */
const calculateImprovement = ({ kpi, baseline, baselineValue, targetValue, actualValue, isInterimSum }) => {
  if (!baseline || ['UNKNOWN', 'PENDING_VERIFICATION'].includes(baseline.baselineStatus)) return { reason: 'The baseline is unknown or not yet verified' };
  if (isInterimSum) return { reason: 'Results are still adding up; improvement is measured at year end' };
  if (baselineValue === null || targetValue === null) return { reason: 'The baseline or target has no numeric value' };

  if (kpi.direction === 'MAINTAIN' || baselineValue === targetValue) {
    const tolerance = toNumber(kpi.maintenanceTolerance);
    if (tolerance === null) return { reason: 'The baseline equals the target and no maintenance tolerance is set' };
    return withinTolerance(actualValue, targetValue, tolerance) ? { raw: 100 } : { reason: 'The result is outside the maintenance tolerance' };
  }
  return { raw: improvementFormula(kpi.direction, baselineValue, targetValue, actualValue) };
};

// ===== Target achievement (SRS 6.2) =====

const exactTarget = (kpi, target, actual) => {
  const tolerance = toNumber(kpi.maintenanceTolerance) ?? 0;
  const met = withinTolerance(actual, target, tolerance);
  if (met) return { raw: 100, met };
  if (target === 0) return { raw: kpi.zeroTargetRule === 'FULL_IF_MET' ? 0 : null, met };
  return { raw: round4(Math.max(0, (1 - Math.abs(actual - target) / Math.abs(target)) * 100)), met };
};

const maximumTarget = (kpi, target, actual) => {
  if (actual <= target) return { raw: 100, met: true };
  if (target === 0) return { raw: kpi.zeroTargetRule === 'FULL_IF_MET' ? 0 : null, met: false };
  return { raw: percent(target, actual), met: false };
};

const minimumTarget = (kpi, target, actual) => {
  if (target === 0) return { raw: kpi.zeroTargetRule === 'FULL_IF_MET' ? 100 : null, met: actual >= 0 };
  return { raw: percent(actual, target), met: actual >= target };
};

const calculateTarget = (kpi, target, actual) => {
  if (kpi.direction === 'MAINTAIN' || kpi.targetType === 'EXACT') return exactTarget(kpi, target, actual);
  return kpi.targetType === 'MAXIMUM' ? maximumTarget(kpi, target, actual) : minimumTarget(kpi, target, actual);
};

const statusFromTarget = (met, actual, target) => {
  if (!met) return 'BELOW_TARGET';
  return actual === target ? 'AT_TARGET' : 'ABOVE_TARGET';
};

// ===== Stages and categories without approved scoring (SRS 7.4, 7.5) =====

/**
 * No percentage is invented: only whether the target level was reached. A binary scale is plain attainment,
 * so it counts as 100 or 0.
 */
const calculateUnscoredLevel = (kpi, targetRow, actualRow) => {
  const orderOf = (row) => kpi.scale.levels.find((level) => level.id === row.scaleLevelId)?.sortOrder;
  const reached = orderOf(actualRow);
  const wanted = orderOf(targetRow);
  const met = kpi.direction === 'LOWER_IS_BETTER' ? reached <= wanted : reached >= wanted;
  return {
    requiredImprovement: null,
    actualImprovement: null,
    improvementCalculable: false,
    notCalculableReason: 'This scale has no approved numerical scoring',
    improvementAchievementRaw: null,
    targetAchievementRaw: kpi.scale.isBinary ? (met ? 100 : 0) : null,
    targetMet: met,
    achievementStatus: met ? (reached === wanted ? 'AT_TARGET' : 'ABOVE_TARGET') : 'BELOW_TARGET',
  };
};

// ===== One line =====

const capValue = (raw, { capOverachievement, maxScorePercent }) => {
  if (raw === null || raw === undefined) return null;
  return capOverachievement ? Math.min(raw, maxScorePercent) : raw;
};

const weighted = (value, weight) => (value === null ? null : round4((value * weight) / 100));

/**
 * The aggregation methods that produce a score directly: share of offices meeting target, weighted score.
 */
const calculateFromScore = (scorePercent) => ({
  requiredImprovement: null,
  actualImprovement: null,
  improvementCalculable: false,
  notCalculableReason: 'This result is a score across subordinate offices',
  improvementAchievementRaw: null,
  targetAchievementRaw: scorePercent,
  targetMet: scorePercent >= 100,
  achievementStatus: scorePercent >= 100 ? 'AT_TARGET' : 'BELOW_TARGET',
});

/**
 * Calculate one achievement.
 *   actual        { value, numerator, denominator, scaleLevelId } or null when nothing was reported
 *   scorePercent  set when the result is a score rather than a measured value
 *   isInterimSum  a running total before year end, shown as progress towards the annual target
 *   settings      { capOverachievement, maxScorePercent }
 * Returns the columns of kpi_achievement.
 */
export const calculateAchievement = ({ kpi, baseline, target, weight, actual, scorePercent = null, isInterimSum = false, settings }) => {
  let result;
  if (scorePercent !== null) {
    result = calculateFromScore(scorePercent);
  } else if (!actual || (actual.value === null && actual.scaleLevelId === null)) {
    result = notReported();
  } else if (isUnscoredScale(kpi)) {
    result = calculateUnscoredLevel(kpi, target, actual);
  } else {
    const baselineValue = numericValue(kpi, baseline);
    const targetValue = numericValue(kpi, target);
    const actualValue = numericValue(kpi, actual);
    const improvement = calculateImprovement({ kpi, baseline, baselineValue, targetValue, actualValue, isInterimSum });
    const { raw, met } = calculateTarget(kpi, targetValue, actualValue);
    const baselineKnown = baselineValue !== null && !['UNKNOWN', 'PENDING_VERIFICATION'].includes(baseline?.baselineStatus);
    result = {
      requiredImprovement: requiredImprovement(kpi, baseline, target),
      actualImprovement: baselineKnown && !isInterimSum && kpi.direction !== 'MAINTAIN' ? actualImprovementOf(kpi.direction, baselineValue, actualValue) : null,
      improvementCalculable: improvement.raw !== undefined,
      notCalculableReason: improvement.reason ?? null,
      improvementAchievementRaw: improvement.raw ?? null,
      targetAchievementRaw: raw,
      targetMet: met,
      achievementStatus: statusFromTarget(met, actualValue, targetValue),
    };
  }

  const improvementAchievementCapped = capValue(result.improvementAchievementRaw, settings);
  const targetAchievementCapped = capValue(result.targetAchievementRaw, settings);
  return {
    ...result,
    improvementAchievementCapped,
    targetAchievementCapped,
    weightedImprovementScore: weighted(improvementAchievementCapped, weight),
    weightedTargetScore: weighted(targetAchievementCapped, weight),
  };
};

/**
 * The university's band for an achievement: the highest band whose minimum it reaches. Negative results fall into
 * the lowest band. The KPI's own scoring method decides which achievement is judged.
 */
export const pickThreshold = (thresholds, kpi, achievement) => {
  const first = kpi.scoringMethod === 'IMPROVEMENT' ? achievement.improvementAchievementCapped : achievement.targetAchievementCapped;
  const second = kpi.scoringMethod === 'IMPROVEMENT' ? achievement.targetAchievementCapped : achievement.improvementAchievementCapped;
  const score = first ?? second;
  if (score === null || score === undefined || thresholds.length === 0) return null;
  const ordered = [...thresholds].sort((a, b) => toNumber(b.minPercent) - toNumber(a.minPercent));
  return ordered.find((band) => score >= toNumber(band.minPercent)) ?? ordered[ordered.length - 1];
};

export default { calculateAchievement, pickThreshold };
