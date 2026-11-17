const round = (value) => Math.round(value * 10000) / 10000;
const byOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
const NO_THEME = { id: 'none', name: 'No theme', sortOrder: 9999 };

/**
 * KPI rows grouped as the university reads them: Theme, then Sub-theme, each with the weight it adds up to.
 * A KPI filed directly under a theme sits in a group without a sub-theme.
 */
export const groupByTheme = (rows) => {
  const themes = new Map();
  for (const row of rows) {
    const theme = row.theme ?? NO_THEME;
    if (!themes.has(theme.id)) themes.set(theme.id, { theme, groups: new Map() });
    const subKey = row.subTheme?.id ?? 'none';
    const groups = themes.get(theme.id).groups;
    if (!groups.has(subKey)) groups.set(subKey, { subTheme: row.subTheme, rows: [] });
    groups.get(subKey).rows.push(row);
  }
  return [...themes.values()]
    .sort((a, b) => byOrder(a.theme, b.theme))
    .map(({ theme, groups }) => ({
      theme,
      groups: [...groups.values()]
        .sort((a, b) => (!a.subTheme ? -1 : !b.subTheme ? 1 : byOrder(a.subTheme, b.subTheme)))
        .map((group) => ({ ...group, weight: round(group.rows.reduce((sum, row) => sum + (row.weight ?? 0), 0)) })),
    }));
};

export const totalWeight = (rows) => round(rows.reduce((sum, row) => sum + (row.weight ?? 0), 0));

/**
 * The unit a KPI is measured in, for the Unit column.
 */
export const unitText = (kpi) => {
  if (kpi.measurementType === 'PERCENTAGE') return '%';
  if (kpi.measurementType === 'MONEY') return kpi.currency?.code ?? '';
  if (kpi.measurementType === 'RATIO') return 'Ratio';
  if (kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY') return 'Level';
  return kpi.unit?.symbol ?? kpi.unit?.name ?? '';
};

// ===== Colour of a performance cell =====

const hueOf = (score) => Math.round(Math.min(100, Math.max(0, score)) * 1.2);

/**
 * A light background for a cell, red through yellow to green, covering the whole cell. The colour of the performance
 * sits in the middle, with the shades either side of it fading out towards red on one side and green on the other.
 * Part way through the year a count that adds up is judged against how far it should be by now (`pace`, the share of
 * the year it covers), so a strong first quarter already shows green. A finished year is judged as it stands.
 * Null when there is no percentage to colour.
 */
export const performanceShade = (percent, pace = 1) => {
  if (percent === null || percent === undefined) return null;
  const score = pace > 0 && pace < 1 ? percent / pace : percent;
  const shade = (offset) => `hsla(${hueOf(score + offset)}, 85%, 48%, 0.6)`;
  return { background: `linear-gradient(90deg, ${shade(-30)}, ${shade(0)}, ${shade(30)})` };
};
