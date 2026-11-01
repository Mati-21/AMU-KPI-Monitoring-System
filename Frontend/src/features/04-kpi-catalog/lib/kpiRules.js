import { optionLabel } from '../../10-system/lib/settingValues';

export const MEASUREMENT_TYPES = ['NUMBER', 'PERCENTAGE', 'RATIO', 'MONEY', 'STAGE', 'CATEGORY'];
export const DIRECTIONS = ['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'MAINTAIN'];
export const SCORING_METHODS = ['TARGET', 'IMPROVEMENT'];
export const ZERO_TARGET_RULES = ['NOT_CALCULABLE', 'FULL_IF_MET'];

const COUNTABLE = { aggregation: ['SUM', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['SUM', 'LATEST', 'AVERAGE'] };
const FRACTION = { aggregation: ['RATIO_OF_SUMS', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['RATIO_OF_SUMS', 'LATEST'] };
const LEVELLED = { aggregation: ['SHARE_MEETING_TARGET', 'STAGE_DISTRIBUTION', 'WEAKEST_LINK', 'WEIGHTED_SCORE', 'DIRECT'], rollup: ['LATEST'] };

// Which methods the backend accepts per measurement type. The first one is the usual choice.
export const RULES_BY_TYPE = { NUMBER: COUNTABLE, MONEY: COUNTABLE, PERCENTAGE: FRACTION, RATIO: FRACTION, STAGE: LEVELLED, CATEGORY: LEVELLED };

const TARGET_TYPES_BY_DIRECTION = { HIGHER_IS_BETTER: ['MINIMUM', 'EXACT'], LOWER_IS_BETTER: ['MAXIMUM', 'EXACT'], MAINTAIN: ['EXACT'] };

export const targetTypesFor = (direction) => TARGET_TYPES_BY_DIRECTION[direction] ?? [];
export const isAdditiveType = (type) => type === 'NUMBER' || type === 'MONEY';
export const usesLabels = (type) => type === 'PERCENTAGE' || type === 'RATIO';
export const usesScale = (type) => type === 'STAGE' || type === 'CATEGORY';

export const toOptions = (values) => values.map((value) => ({ value, label: optionLabel(value) }));

/**
 * Themes as select options, with sub-themes indented under their parent.
 */
export const flattenThemes = (nodes = [], depth = 0) => nodes.flatMap((node) => [{ ...node, depth }, ...flattenThemes(node.children, depth + 1)]);

/**
 * The themes from the top of the tree down to this one, or an empty list.
 */
export const themePath = (nodes = [], id) => {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const below = themePath(node.children, id);
    if (below.length > 0) return [node, ...below];
  }
  return [];
};

/**
 * A KPI's top-level theme and, separately, where it sits below that.
 */
export const themeNames = (nodes, id) => {
  const [theme, ...subThemes] = themePath(nodes, id);
  return { theme: theme?.name ?? null, subTheme: subThemes.map((node) => node.name).join(' / ') || null };
};

/**
 * Themes as a flat list numbered by their place in the tree: 1, 1.1, 1.1.1.
 */
export const numberThemes = (nodes = [], prefix = '', depth = 0) =>
  nodes.flatMap((node, index) => {
    const number = `${prefix}${index + 1}`;
    return [{ ...node, depth, number }, ...numberThemes(node.children, `${number}.`, depth + 1)];
  });

export const themeOptions = (nodes,{ activeOnly = false, except } = {}) =>
  flattenThemes(nodes)
    .filter((theme) => theme.id !== except && (!activeOnly || theme.isActive))
    .map((theme) => ({ value: theme.id, label: `${'— '.repeat(theme.depth)}${theme.name}` }));

// Fields the backend's messages name, in the words the form uses
const FIELD_LABELS = {
  code: 'Code',
  name: 'Name',
  description: 'Description',
  themeId: 'Theme',
  strategicObjectiveId: 'Strategic objective',
  measurementType: 'Measurement type',
  direction: 'Direction',
  defaultFrequencyId: 'Reporting frequency',
  aggregationMethod: 'Combining offices',
  periodRollupMethod: 'Combining periods',
  numeratorLabel: 'Numerator label',
  denominatorLabel: 'Denominator label',
  maintenanceTolerance: 'Allowed variation',
  decimalPlaces: 'Decimal places',
  unitId: 'Unit',
  scaleId: 'Scale',
  currencyId: 'Currency',
};

/**
 * One of the backend's messages about a KPI, in the words the form uses.
 */
export const friendlyProblem = (text) => {
  const friendly = Object.entries(FIELD_LABELS).reduce((message, [key, label]) => message.replace(new RegExp(`\\b${key}\\b`, 'g'), label), text);
  return friendly.charAt(0).toUpperCase() + friendly.slice(1);
};

/**
 * The backend's list of problems with a KPI, in readable words.
 */
export const kpiErrors = (error) => (error?.response?.data?.details?.errors ?? []).map(friendlyProblem);
