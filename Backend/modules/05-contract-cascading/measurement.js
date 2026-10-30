import { badRequest } from '../../utils/httpError.js';
import { optionalString, parseNumber, parseUuid } from '../../utils/validation.js';

/**
 * How baseline, target and actual values work per measurement type (SRS 7).
 * Shared by assignments (Module 05) and reporting (Module 07) so the rules live in one place.
 */

export const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

const round4 = (value) => Math.round(value * 10000) / 10000;

const nonNegative = (value, field) => {
  const number = parseNumber(value, field);
  if (number !== undefined && number < 0) throw badRequest(`${field} cannot be negative`);
  return number;
};

const EMPTY = { value: null, numerator: null, denominator: null, scaleLevelId: null, currencyId: null };

/**
 * Value of a percentage or ratio from its numerator and denominator (never divides by zero).
 */
const fromParts = (kpi, numerator, denominator, field) => {
  if (denominator === undefined || numerator === undefined) throw badRequest(`${field} needs both numerator and denominator`);
  if (denominator === 0) throw badRequest(`${field} denominator cannot be zero`);
  if (kpi.measurementType === 'PERCENTAGE' && numerator > denominator) throw badRequest(`${field} numerator cannot exceed the denominator`);
  const ratio = numerator / denominator;
  return round4(kpi.measurementType === 'PERCENTAGE' ? ratio * 100 : ratio);
};

/**
 * Validate one measured value against the KPI and return the columns to store.
 * requireParts: percentages and ratios must give numerator and denominator (baselines and actuals do; a target
 * may give just the percentage or ratio, SRS 7.2).
 * kpi must include scale.levels.
 */
export const parseMeasuredValue = (kpi, input, field, { requireParts = false } = {}) => {
  if (!input || typeof input !== 'object') throw badRequest(`${field} is required`);
  const type = kpi.measurementType;

  if (type === 'NUMBER' || type === 'MONEY') {
    const value = nonNegative(input.value, `${field}.value`);
    if (value === undefined) throw badRequest(`${field}.value is required`);
    if (type === 'NUMBER') return { ...EMPTY, value };
    const currencyId = parseUuid(input.currencyId, `${field}.currencyId`, { required: false }) ?? kpi.currencyId;
    if (currencyId !== kpi.currencyId) throw badRequest(`${field} must use the KPI's currency`);
    return { ...EMPTY, value, currencyId };
  }

  if (type === 'PERCENTAGE' || type === 'RATIO') {
    const numerator = nonNegative(input.numerator, `${field}.numerator`);
    const denominator = nonNegative(input.denominator, `${field}.denominator`);
    if (numerator !== undefined || denominator !== undefined || requireParts) {
      return { ...EMPTY, value: fromParts(kpi, numerator, denominator, field), numerator, denominator };
    }
    const value = nonNegative(input.value, `${field}.value`);
    if (value === undefined) throw badRequest(`${field} needs a value, or numerator and denominator`);
    if (type === 'PERCENTAGE' && value > 100) throw badRequest(`${field}.value cannot be above 100`);
    return { ...EMPTY, value };
  }

  // STAGE and CATEGORY: must be a level of the KPI's own scale (SRS 17.11)
  const scaleLevelId = parseUuid(input.scaleLevelId, `${field}.scaleLevelId`);
  if (!kpi.scale.levels.some((level) => level.id === scaleLevelId)) throw badRequest(`${field}.scaleLevelId is not a level of scale "${kpi.scale.name}"`);
  return { ...EMPTY, scaleLevelId };
};

const BASELINE_STATUSES = ['KNOWN', 'UNKNOWN', 'PENDING_VERIFICATION'];

/**
 * Baseline columns. An unknown baseline is never stored as zero: it has no value and needs a justification (SRS 5.6).
 */
export const parseBaseline = (kpi, input, field = 'baseline') => {
  if (!input || typeof input !== 'object') throw badRequest(`${field} is required`);
  const baselineStatus = input.status ?? 'KNOWN';
  if (!BASELINE_STATUSES.includes(baselineStatus)) throw badRequest(`${field}.status must be one of: ${BASELINE_STATUSES.join(', ')}`);

  const unknownJustification = optionalString(input.justification, `${field}.justification`) ?? null;
  if (baselineStatus === 'KNOWN') return { baselineStatus, unknownJustification: null, ...parseMeasuredValue(kpi, input, field, { requireParts: true }) };

  if (!unknownJustification) throw badRequest(`${field}.justification is required when the baseline is ${baselineStatus}`);
  return { baselineStatus, unknownJustification, ...EMPTY };
};

export const parseTarget = (kpi, input, field = 'target') => parseMeasuredValue(kpi, input, field);

export const parseWeight = (input, field = 'weight') => {
  const weight = parseNumber(input, field, { required: true });
  if (weight <= 0 || weight > 100) throw badRequest(`${field} must be above 0 and at most 100`);
  return weight;
};

/**
 * The number used in calculations. Stages and categories have one only when their scale's scoring is approved.
 */
export const numericValue = (kpi, row) => {
  if (!row) return null;
  if (kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY') {
    if (!kpi.scale?.scoringApproved) return null;
    return toNumber(kpi.scale.levels.find((level) => level.id === row.scaleLevelId)?.score);
  }
  return toNumber(row.value);
};

/**
 * Required improvement or reduction (SRS 5.3), or null when it cannot be calculated.
 */
export const requiredImprovement = (kpi, baseline, target) => {
  if (!baseline || ['UNKNOWN', 'PENDING_VERIFICATION'].includes(baseline.baselineStatus)) return null;
  const start = numericValue(kpi, baseline);
  const end = numericValue(kpi, target);
  if (start === null || end === null) return null;
  if (kpi.direction === 'MAINTAIN') return 0;
  return round4(kpi.direction === 'LOWER_IS_BETTER' ? start - end : end - start);
};

export default { toNumber, parseMeasuredValue, parseBaseline, parseTarget, parseWeight, numericValue, requiredImprovement };
