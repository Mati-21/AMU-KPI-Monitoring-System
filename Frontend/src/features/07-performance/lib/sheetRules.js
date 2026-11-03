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
