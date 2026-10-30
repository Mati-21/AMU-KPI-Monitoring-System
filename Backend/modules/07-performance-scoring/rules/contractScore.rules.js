/**
 * The weighted score of a contract (SRS 9.3, 9.7). Pure functions with no database access.
 * Importance weights are never added up across offices: each contract is scored on its own weights.
 */

const round4 = (value) => Math.round(value * 10000) / 10000;

/**
 * Weighted average over the lines that have a score. A missing result is not a zero: it is left out, the weight with
 * results is reported beside the score, and the score is marked provisional.
 */
const weightedAverage = (lines, scoreKey) => {
  const scored = lines.filter((line) => line[scoreKey] !== null && line[scoreKey] !== undefined);
  const weight = scored.reduce((total, line) => total + line.weight, 0);
  if (weight === 0) return null;
  return round4(scored.reduce((total, line) => total + line[scoreKey] * line.weight, 0) / weight);
};

/**
 * lines: [{ weight, improvementAchievementCapped, targetAchievementCapped, achievementStatus }]
 * Returns the columns of contract_score.
 */
export const calculateContractScore = (lines, { officialBasis, isProvisional }) => {
  const totalWeight = round4(lines.reduce((total, line) => total + line.weight, 0));
  const reportedWeight = round4(lines.filter((line) => line.achievementStatus !== 'NOT_REPORTED').reduce((total, line) => total + line.weight, 0));
  return {
    totalWeight,
    reportedWeight,
    weightedImprovementScore: weightedAverage(lines, 'improvementAchievementCapped'),
    weightedTargetScore: weightedAverage(lines, 'targetAchievementCapped'),
    officialBasis,
    isProvisional: isProvisional || reportedWeight < totalWeight,
  };
};

export default { calculateContractScore };
