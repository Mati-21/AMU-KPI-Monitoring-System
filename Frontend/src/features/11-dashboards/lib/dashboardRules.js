/**
 * How dashboard figures are read and worded. Only approved results count; a missing, waiting or returned result is
 * named as such and never shown as 0%.
 */

// What each KPI outcome is called, and whether it counts as a scored result
export const OUTCOMES = {
  EXCEEDING: { label: 'Above target', tile: 'Above target' },
  MEETING: { label: 'On target', tile: 'On target' },
  BELOW: { label: 'Below target', tile: 'Below target' },
  IN_PROGRESS: { label: 'In progress', tile: 'In progress' },
  PENDING: { label: 'Waiting for approval', tile: 'Waiting approval' },
  RETURNED: { label: 'Sent back', tile: 'Sent back' },
  REJECTED: { label: 'Rejected', tile: 'Rejected' },
  NOT_REPORTED: { label: 'Not reported yet', tile: 'Not reported' },
  NOT_CALCULABLE: { label: 'No score for this result', tile: 'No score' },
};

// The tiles a dashboard shows, in reading order; zero tiles beyond the first four are left out
export const TILE_KEYS = [
  ['exceeding', 'EXCEEDING'],
  ['meeting', 'MEETING'],
  ['below', 'BELOW'],
  ['inProgress', 'IN_PROGRESS'],
  ['pending', 'PENDING'],
  ['returned', 'RETURNED'],
  ['rejected', 'REJECTED'],
  ['notReported', 'NOT_REPORTED'],
];

const round1 = (value) => Math.round(value * 10) / 10;

export const percentText = (value) => (value === null || value === undefined ? '-' : `${round1(value)}%`);

/**
 * The university's band a percentage falls in: the highest band whose minimum it reaches.
 */
export const bandFor = (percent, bands = []) => {
  if (percent === null || percent === undefined || bands.length === 0) return null;
  return bands.find((band) => percent >= band.minPercent) ?? bands[bands.length - 1];
};

/**
 * One KPI's official achievement as the dashboard shows it. The KPI's own scoring method decides which percentage
 * counts. A total still adding up before year end is progress, not a shortfall.
 */
export const achievementOf = (line) => {
  const { official } = line;
  if (!official) return { percent: null, band: null, isRunningTotal: false };
  const byImprovement = line.kpi.scoringMethod === 'IMPROVEMENT';
  const percent = byImprovement ? official.improvementAchievementCapped ?? official.targetAchievementCapped : official.targetAchievementCapped;
  return { percent, band: official.isRunningTotal ? null : official.band, isRunningTotal: official.isRunningTotal };
};

// Lowest first, so what needs attention leads; results without a percentage come after the scored ones
export const weakestFirst = (lines) =>
  [...lines].sort((a, b) => {
    const pa = achievementOf(a).percent;
    const pb = achievementOf(b).percent;
    if ((pa === null) !== (pb === null)) return pa === null ? 1 : -1;
    return (pa ?? 0) - (pb ?? 0) || a.kpi.name.localeCompare(b.kpi.name);
  });

const number = (value) => (value === null || value === undefined ? null : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }));

/**
 * A result or target in plain words: 199 hrs, 75.2%, 20.1. Stages and ratings are named on the contract and report
 * pages; here their achievement says enough.
 */
export const measureText = (kpi, row) => {
  if (!row) return null;
  if (kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY') return null;
  const hasParts = row.numerator !== null && row.numerator !== undefined && row.denominator;
  if (kpi.measurementType === 'PERCENTAGE') return `${round1(hasParts ? (row.numerator / row.denominator) * 100 : row.value)}%`;
  if (kpi.measurementType === 'RATIO') return number(hasParts ? row.numerator / row.denominator : row.value);
  const value = number(row.value);
  if (kpi.measurementType === 'MONEY') return value === null ? null : `${value} ${kpi.currency?.code ?? ''}`.trim();
  // A plain count needs no symbol; hours, people and the like say what they are
  const symbol = kpi.unit?.symbol && kpi.unit.symbol !== '#' ? ` ${kpi.unit.symbol}` : '';
  return value === null ? null : `${value}${symbol}`;
};

// The result the official achievement was worked out from
export const actualOf = (line) => {
  const { official } = line;
  if (!official) return null;
  return { value: official.actualValue, numerator: official.actualNumerator, denominator: official.actualDenominator };
};

/**
 * The score trend, one series per reporting frequency, oldest period first. A frequency with a single point (the
 * year end) is left to the score card.
 */
export const trendByFrequency = (trend = []) => {
  const groups = new Map();
  for (const point of trend) {
    const frequency = point.reportingPeriod.frequency;
    if (!frequency) continue;
    if (!groups.has(frequency.id)) groups.set(frequency.id, { frequency, points: [] });
    groups.get(frequency.id).points.push(point);
  }
  return [...groups.values()].filter((group) => group.points.length > 1).sort((a, b) => (a.frequency.intervalMonths ?? 99) - (b.frequency.intervalMonths ?? 99));
};

// Quarterly reads best when it is there, then the shortest frequency
export const defaultFrequencyId = (groups) => (groups.find((group) => group.frequency.intervalMonths === 3) ?? groups[0])?.frequency.id ?? null;

const fullName = (person) => (person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : '');
export { fullName };

/**
 * What the person should do next about their own reporting: what was sent back, what is overdue or due soon, and
 * what is waiting for approval. Approved periods need nothing.
 */
export const todoFromDeadlines = (deadlines = []) => {
  const items = [];
  for (const deadline of deadlines) {
    const name = deadline.reportingPeriod.name;
    if (deadline.state === 'RETURNED' || deadline.state === 'REJECTED') items.push({ tone: 'critical', text: `${name} was sent back: correct it and submit again` });
    else if (deadline.state === 'PENDING') items.push({ tone: 'neutral', text: `${name} is waiting for approval` });
    else if (deadline.state === 'MISSING' && deadline.isOverdue) items.push({ tone: 'critical', text: `${name} is overdue` });
    else if (deadline.state === 'MISSING' && deadline.daysLeft !== null && deadline.daysLeft >= 0 && deadline.daysLeft <= 14) {
      items.push({ tone: 'warning', text: deadline.daysLeft === 0 ? `${name} is due today` : `${name} is due in ${deadline.daysLeft} day${deadline.daysLeft === 1 ? '' : 's'}` });
    }
  }
  const order = { critical: 0, warning: 1, neutral: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
};
