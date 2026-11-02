import * as XLSX from 'xlsx';

import { DIRECTIONS, MEASUREMENT_TYPES, flattenThemes, toOptions } from './kpiRules';

const SHEET_NAME = 'KPIs';
const TARGET_TYPES = ['MINIMUM', 'MAXIMUM', 'EXACT'];
export const MAX_ROWS = 500;

const COLUMNS = [
  { name: 'Name', needed: 'Always', help: 'The name of the KPI, as the ministry writes it. A KPI already registered under this name is not registered again.' },
  { name: 'Description', needed: 'Always', help: 'What it measures.' },
  { name: 'Theme', needed: 'Always', help: 'Written as in the Allowed Values sheet.' },
  { name: 'Sub-Theme', needed: 'When the theme has sub-themes', help: 'Written as in the Allowed Values sheet.' },
  { name: 'Reporting Frequency', needed: 'Always', help: 'Written as in the Allowed Values sheet.' },
  { name: 'Measurement Type', needed: 'Always', help: 'Number, Percentage, Ratio, Money, Stage or Category.' },
  { name: 'Direction', needed: 'Always', help: 'Higher is better, Lower is better or Maintain.' },
  { name: 'Target Type', needed: 'Optional', help: 'Minimum, Maximum or Exact. Left empty, it follows the direction.' },
  { name: 'Unit', needed: 'Number KPIs', help: 'Its name or symbol.' },
  { name: 'Currency', needed: 'Money KPIs', help: 'Its code, such as ETB.' },
  { name: 'Scale', needed: 'Stage and Category KPIs', help: 'A scale of the same type as the KPI.' },
  { name: 'Numerator Label', needed: 'Percentage and Ratio KPIs', help: 'What is counted, such as Graduates.' },
  { name: 'Denominator Label', needed: 'Percentage and Ratio KPIs', help: 'What it is out of, such as Enrolled students.' },
  { name: 'Allowed Variation', needed: 'Maintain KPIs', help: 'How far from the target still counts as maintained.' },
  { name: 'Remark', needed: 'Optional', help: 'Anything worth noting about the KPI.' },
];

const REQUIRED_HEADERS = ['Name', 'Theme', 'Measurement Type', 'Direction'];

// Extra columns when the KPIs go straight into the self contract
const CONTRACT_COLUMNS = [
  { name: 'Baseline Status', needed: 'Optional', help: 'Known, Unknown or Pending verification. Left empty, it is Known.' },
  { name: 'Baseline', needed: 'Known Number, Money, Stage and Category baselines', help: 'The starting value, or the level name for Stage and Category KPIs.' },
  { name: 'Baseline Numerator', needed: 'Known Percentage and Ratio baselines', help: 'What was counted, such as 450 graduates.' },
  { name: 'Baseline Denominator', needed: 'Known Percentage and Ratio baselines', help: 'What it was out of, such as 600 enrolled students.' },
  { name: 'Baseline Note', needed: 'Unknown or pending baselines', help: 'Why there is no value yet.' },
  { name: 'Target', needed: 'Always', help: 'The value to reach, such as 80 for 80%. The level name for Stage and Category KPIs.' },
  { name: 'Weight', needed: 'Always', help: "The KPI's share of the contract. The weights of a contract add up to 100." },
];
export const CONTRACT_REQUIRED_HEADERS = ['Name', 'Target', 'Weight'];
const BASELINE_STATUSES = ['KNOWN', 'UNKNOWN', 'PENDING_VERIFICATION'];

const EXAMPLE = {
  Name: 'Published research papers',
  Description: 'Papers published in reviewed journals',
  'Measurement Type': 'Number',
  Direction: 'Higher is better',
  Baseline: '120',
  Target: '150',
  Weight: '10',
};

// Spelling and capitals do not have to match exactly: "higher is better" and "HIGHER_IS_BETTER" are the same
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const allowedValues = ({ themes, frequencies, units, currencies, scales }) => ({
  Theme: themes.filter((theme) => theme.isActive).map((theme) => theme.name),
  'Sub-Theme': themes.flatMap((theme) => flattenThemes(theme.children).filter((sub) => sub.isActive).map((sub) => sub.name)),
  'Reporting Frequency': frequencies.map((frequency) => frequency.name),
  'Measurement Type': toOptions(MEASUREMENT_TYPES).map((option) => option.label),
  Direction: toOptions(DIRECTIONS).map((option) => option.label),
  'Target Type': toOptions(TARGET_TYPES).map((option) => option.label),
  Unit: units.map((unit) => unit.name),
  Currency: currencies.map((currency) => currency.code),
  Scale: scales.map((scale) => scale.name),
  'Baseline Status': ['Known', 'Unknown', 'Pending verification'],
});

/**
 * An empty template: one sheet to fill in, one explaining the columns, one with this university's current choices.
 * forContract adds the baseline, target and weight of each KPI on the self contract.
 */
export const downloadTemplate = (catalog, { forContract = false } = {}) => {
  const book = XLSX.utils.book_new();
  const columns = forContract ? [...COLUMNS, ...CONTRACT_COLUMNS] : COLUMNS;
  const headers = columns.map((column) => column.name);
  const kpis = XLSX.utils.aoa_to_sheet([headers]);
  kpis['!cols'] = headers.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
  XLSX.utils.book_append_sheet(book, kpis, SHEET_NAME);

  const note = forContract ? [['A KPI already in KPI Management only needs its Name and the contract columns.', '', '', '']] : [];
  const help = XLSX.utils.aoa_to_sheet([['Column', 'Needed', 'What to enter', 'Example'], ...columns.map((column) => [column.name, column.needed, column.help, EXAMPLE[column.name] ?? '']), ...note]);
  help['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 60 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(book, help, 'Help');

  const { 'Baseline Status': baselineStatuses, ...kpiValues } = allowedValues(catalog);
  const allowed = forContract ? { ...kpiValues, 'Baseline Status': baselineStatuses } : kpiValues;
  const allowedNames = Object.keys(allowed);
  const depth = Math.max(...Object.values(allowed).map((values) => values.length));
  const rows = Array.from({ length: depth }, (_, index) => allowedNames.map((name) => allowed[name][index] ?? ''));
  const values = XLSX.utils.aoa_to_sheet([allowedNames, ...rows]);
  values['!cols'] = allowedNames.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(book, values, 'Allowed Values');

  XLSX.writeFile(book, forContract ? 'self-contract-kpi-template.xlsx' : 'kpi-template.xlsx');
};

/**
 * The filled rows of an uploaded file, each with its row number in Excel. Throws a readable message for a wrong file.
 */
export const readKpiFile = async (file, requiredHeaders = REQUIRED_HEADERS) => {
  const book = XLSX.read(await file.arrayBuffer());
  const sheet = book.Sheets[SHEET_NAME] ?? book.Sheets[book.SheetNames[0]];
  const [headers = []] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const missing = requiredHeaders.filter((name) => !headers.map((header) => String(header).trim()).includes(name));
  if (missing.length > 0) throw new Error(`This file does not follow the template. Missing columns: ${missing.join(', ')}.`);

  const rows = XLSX.utils
    .sheet_to_json(sheet, { defval: '', blankrows: true })
    .map((cells, index) => ({ rowNumber: index + 2, cells: Object.fromEntries(Object.entries(cells).map(([key, value]) => [key.trim(), String(value).trim()])) }))
    .filter(({ cells }) => Object.values(cells).some(Boolean));

  if (rows.length === 0) throw new Error('This file has no KPIs in it.');
  if (rows.length > MAX_ROWS) throw new Error(`This file has ${rows.length} KPIs, and one file can hold at most ${MAX_ROWS}.`);
  return rows;
};

const findBy = (records, value, ...keys) => records.find((record) => keys.some((key) => normalize(record[key]) === normalize(value)));

/**
 * Turn the words in a row into what the backend expects, collecting what could not be understood.
 */
export const rowToKpi = (cells, { themes, frequencies, units, currencies, scales }) => {
  const errors = [];
  const values = {};

  const copy = (column, key) => {
    if (cells[column]) values[key] = cells[column];
  };
  const match = (column, key, find, words = column.toLowerCase()) => {
    if (!cells[column]) return null;
    const found = find(cells[column]);
    if (!found) errors.push(`${column} "${cells[column]}" was not found in the ${words} list`);
    else values[key] = found;
    return found;
  };
  const choice = (column, key, allowed) => match(column, key, (text) => allowed.find((value) => normalize(value) === normalize(text)));
  const required = (column) => {
    if (!cells[column]) errors.push(`${column} is empty`);
  };

  ['Name', 'Description', 'Theme', 'Reporting Frequency', 'Measurement Type', 'Direction'].forEach(required);
  copy('Name', 'name');
  copy('Description', 'description');
  copy('Remark', 'remark');

  const theme = cells.Theme && findBy(themes.filter((candidate) => candidate.isActive), cells.Theme, 'name');
  if (cells.Theme && !theme) errors.push(`Theme "${cells.Theme}" was not found in the theme list`);
  if (theme) {
    const subThemes = flattenThemes(theme.children).filter((sub) => sub.isActive);
    const subTheme = cells['Sub-Theme'] && findBy(subThemes, cells['Sub-Theme'], 'name');
    if (cells['Sub-Theme'] && !subTheme) errors.push(`Sub-Theme "${cells['Sub-Theme']}" is not under theme "${theme.name}"`);
    if (!cells['Sub-Theme'] && subThemes.length > 0) errors.push(`Theme "${theme.name}" has sub-themes, so choose one`);
    values.themeId = subTheme?.id ?? theme.id;
  }

  match('Reporting Frequency', 'defaultFrequencyId', (text) => findBy(frequencies, text, 'name')?.id);
  const type = choice('Measurement Type', 'measurementType', MEASUREMENT_TYPES);
  choice('Direction', 'direction', DIRECTIONS);
  choice('Target Type', 'targetType', TARGET_TYPES);

  if (type === 'NUMBER') match('Unit', 'unitId', (text) => findBy(units, text, 'name', 'symbol')?.id);
  match('Currency', 'currencyId', (text) => findBy(currencies, text, 'code')?.id);
  match('Scale', 'scaleId', (text) => findBy(scales, text, 'name')?.id);
  copy('Numerator Label', 'numeratorLabel');
  copy('Denominator Label', 'denominatorLabel');

  if (cells['Allowed Variation']) {
    const tolerance = Number(cells['Allowed Variation']);
    if (Number.isNaN(tolerance)) errors.push('Allowed Variation must be a number');
    else values.maintenanceTolerance = tolerance;
  }

  return { values, errors };
};

/**
 * A row for the self contract: the KPI, and its baseline, target and weight. Problems with the KPI's own columns are
 * kept apart, because they do not matter when the KPI is already registered.
 */
export const rowToContractRow = (cells, catalog) => {
  const { values, errors: kpiErrors } = rowToKpi(cells, catalog);
  const errors = [];
  const number = (column) => {
    const value = Number(cells[column]);
    if (Number.isNaN(value)) errors.push(`${column} must be a number`);
    return value;
  };
  // A word is a level of the KPI's scale, a number is a value
  const measure = (column) => (Number.isNaN(Number(cells[column])) ? { level: cells[column] } : { value: Number(cells[column]) });

  const status = cells['Baseline Status'] ? BASELINE_STATUSES.find((value) => normalize(value) === normalize(cells['Baseline Status'])) : 'KNOWN';
  if (!status) errors.push(`Baseline Status "${cells['Baseline Status']}" must be Known, Unknown or Pending verification`);
  const baseline = { status: status ?? 'KNOWN' };
  if (baseline.status !== 'KNOWN') baseline.justification = cells['Baseline Note'];
  else if (cells['Baseline Numerator'] || cells['Baseline Denominator']) Object.assign(baseline, { numerator: number('Baseline Numerator'), denominator: number('Baseline Denominator') });
  else if (cells.Baseline) Object.assign(baseline, measure('Baseline'));
  else errors.push('Baseline is empty');

  if (!cells.Target) errors.push('Target is empty');
  if (!cells.Weight) errors.push('Weight is empty');
  return { kpi: values, kpiErrors, baseline, target: cells.Target ? measure('Target') : {}, weight: cells.Weight ? number('Weight') : undefined, errors };
};
