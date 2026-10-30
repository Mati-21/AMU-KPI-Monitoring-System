import { toNumber } from '../../05-contract-cascading/measurement.js';

/**
 * How results combine (SRS 7.2, 7.3, 8). Pure functions with no database access.
 * A result is { value, numerator, denominator, scaleLevelId }.
 * Percentages and ratios always combine through their parts, never by averaging.
 */

const round4 = (value) => Math.round(value * 10000) / 10000;

const hasResult = (result) => Boolean(result) && (result.value !== null || result.scaleLevelId !== null);

const emptyResult = { value: null, numerator: null, denominator: null, scaleLevelId: null };

const sum = (results, key) => results.reduce((total, result) => total + toNumber(result[key]), 0);

/**
 * Total numerator over total denominator. Without a usable denominator there is no result, not a zero.
 */
const ratioOfSums = (kpi, results) => {
  const parts = results.filter((result) => result.numerator !== null && result.denominator !== null);
  const numerator = sum(parts, 'numerator');
  const denominator = sum(parts, 'denominator');
  if (parts.length === 0 || denominator === 0) return null;
  const ratio = numerator / denominator;
  return { ...emptyResult, numerator, denominator, value: round4(kpi.measurementType === 'PERCENTAGE' ? ratio * 100 : ratio) };
};

// ===== Across periods: quarters into the year =====

const PERIOD_METHODS = {
  SUM: (kpi, results) => ({ ...emptyResult, value: round4(sum(results, 'value')) }),
  RATIO_OF_SUMS: ratioOfSums,
  LATEST: (kpi, results) => results[results.length - 1],
  AVERAGE: (kpi, results) => ({ ...emptyResult, value: round4(sum(results, 'value') / results.length) }),
};

/**
 * Combine one KPI's results of several periods, given earliest first, with the KPI's period_rollup_method.
 * Periods with no result are skipped, never counted as zero.
 */
export const rollUpPeriods = (kpi, results) => {
  const reported = results.filter(hasResult);
  if (reported.length === 0) return null;
  return PERIOD_METHODS[kpi.periodRollupMethod](kpi, reported);
};

// ===== Across offices: subordinate offices into the parent =====

/**
 * The lowest level reached, or the worst value given the KPI's direction: the parent is only as strong as its weakest office.
 */
const weakestLink = (kpi, children) => {
  const lowerIsBetter = kpi.direction === 'LOWER_IS_BETTER';
  if (kpi.scale) {
    const orderOf = (result) => kpi.scale.levels.find((level) => level.id === result.scaleLevelId)?.sortOrder ?? 0;
    const weakest = children.reduce((worst, child) => {
      const isWorse = lowerIsBetter ? orderOf(child.result) > orderOf(worst.result) : orderOf(child.result) < orderOf(worst.result);
      return isWorse ? child : worst;
    });
    return { kind: 'VALUE', result: weakest.result };
  }
  const values = children.map((child) => toNumber(child.result.value));
  return { kind: 'VALUE', result: { ...emptyResult, value: lowerIsBetter ? Math.max(...values) : Math.min(...values) } };
};

const shareMeetingTarget = (children) => {
  const met = children.filter((child) => child.targetMet === true).length;
  return { kind: 'SCORE', scorePercent: round4((met / children.length) * 100) };
};

const weightedScore = (children) => {
  const scored = children.filter((child) => child.targetAchievement !== null && child.targetAchievement !== undefined);
  const totalWeight = scored.reduce((total, child) => total + child.weight, 0);
  if (totalWeight === 0) return { kind: 'NONE' };
  return { kind: 'SCORE', scorePercent: round4(scored.reduce((total, child) => total + child.targetAchievement * child.weight, 0) / totalWeight) };
};

/**
 * How many offices reached each level. Informational: it is shown beside the result, not turned into a number.
 */
const stageDistribution = (kpi, children) => ({
  kind: 'DISTRIBUTION',
  distribution: kpi.scale.levels.map((level) => ({
    scaleLevelId: level.id,
    name: level.name,
    officeCount: children.filter((child) => child.result.scaleLevelId === level.id).length,
  })),
});

const OFFICE_METHODS = {
  SUM: (kpi, children) => ({ kind: 'VALUE', result: { ...emptyResult, value: round4(sum(children.map((child) => child.result), 'value')) } }),
  RATIO_OF_SUMS: (kpi, children) => {
    const result = ratioOfSums(kpi, children.map((child) => child.result));
    return result ? { kind: 'VALUE', result } : { kind: 'NONE' };
  },
  WEAKEST_LINK: weakestLink,
  SHARE_MEETING_TARGET: (kpi, children) => shareMeetingTarget(children),
  WEIGHTED_SCORE: (kpi, children) => weightedScore(children),
  STAGE_DISTRIBUTION: stageDistribution,
  DIRECT: () => ({ kind: 'NONE' }),
};

/**
 * Combine subordinate offices with the KPI's aggregation_method.
 * children: [{ result, targetMet, targetAchievement, weight }] for offices that have reported.
 */
export const aggregateOffices = (kpi, children) => {
  const reported = children.filter((child) => hasResult(child.result));
  if (reported.length === 0) return { kind: 'NONE' };
  return OFFICE_METHODS[kpi.aggregationMethod](kpi, reported);
};

/**
 * The parent's total, without double counting (SRS 8.4).
 * Exclusive, complete scopes add the parent's own direct work to what its offices did. Where scopes overlap, or the KPI
 * measures an institution-wide outcome, adding would double count, so the parent's own reported figure stands.
 */
export const combineDirectAndAggregated = (kpi, scopeRelation, direct, aggregated) => {
  const directResult = hasResult(direct) ? direct : null;
  if (aggregated.kind !== 'VALUE') return directResult;
  if (kpi.aggregationMethod === 'WEAKEST_LINK') return aggregated.result;
  if (scopeRelation !== 'EXCLUSIVE_COMPLETE') return directResult;
  if (!directResult) return aggregated.result;
  if (kpi.aggregationMethod === 'RATIO_OF_SUMS') return ratioOfSums(kpi, [directResult, aggregated.result]);
  return { ...emptyResult, value: round4(toNumber(directResult.value) + toNumber(aggregated.result.value)) };
};

export default { rollUpPeriods, aggregateOffices, combineDirectAndAggregated };
