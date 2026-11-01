import * as XLSX from 'xlsx';

import { DIRECTIONS, MEASUREMENT_TYPES, flattenThemes, toOptions } from './kpiRules';

const SHEET_NAME = 'KPIs';
const TARGET_TYPES = ['MINIMUM', 'MAXIMUM', 'EXACT'];
export const MAX_ROWS = 500;

const COLUMNS = [
  { name: 'Code', needed: 'Always', help: 'A short unique code, such as ACAD-01.' },
  { name: 'Name', needed: 'Always', help: 'The name of the KPI.' },
  { name: 'Description', needed: 'Always', help: 'What it measures.' },
  { name: 'Theme', needed: 'Always', help: 'Written as in the Allowed Values sheet.' },
  { name: 'Sub-Theme', needed: 'When the theme has sub-themes', help: 'Written as in the Allowed Values sheet.' },
  { name: 'Strategic Objective', needed: 'Always', help: 'Its code or its name.' },
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
];

const REQUIRED_HEADERS = ['Code', 'Name', 'Theme', 'Measurement Type', 'Direction'];

const EXAMPLE = {
  Code: 'ACAD-01',
  Name: 'Published research papers',
  Description: 'Papers published in reviewed journals',
  'Measurement Type': 'Number',
  Direction: 'Higher is better',
};

// Spelling and capitals do not have to match exactly: "higher is better" and "HIGHER_IS_BETTER" are the same
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const allowedValues = ({ themes, objectives, frequencies, units, currencies, scales }) => ({
  Theme: themes.filter((theme) => theme.isActive).map((theme) => theme.name),
  'Sub-Theme': themes.flatMap((theme) => flattenThemes(theme.children).filter((sub) => sub.isActive).map((sub) => sub.name)),
  'Strategic Objective': objectives.filter((objective) => objective.isActive).map((objective) => objective.name),
  'Reporting Frequency': frequencies.map((frequency) => frequency.name),
  'Measurement Type': toOptions(MEASUREMENT_TYPES).map((option) => option.label),
  Direction: toOptions(DIRECTIONS).map((option) => option.label),
  'Target Type': toOptions(TARGET_TYPES).map((option) => option.label),
  Unit: units.map((unit) => unit.name),
  Currency: currencies.map((currency) => currency.code),
  Scale: scales.map((scale) => scale.name),
});

/**
 * An empty template: one sheet to fill in, one explaining the columns, one with this university's current choices.
 */
export const downloadTemplate = (catalog) => {
  const book = XLSX.utils.book_new();
  const headers = COLUMNS.map((column) => column.name);
  const kpis = XLSX.utils.aoa_to_sheet([headers]);
  kpis['!cols'] = headers.map((name) => ({ wch: Math.max(name.length + 2, 16) }));
  XLSX.utils.book_append_sheet(book, kpis, SHEET_NAME);

  const help = XLSX.utils.aoa_to_sheet([['Column', 'Needed', 'What to enter', 'Example'], ...COLUMNS.map((column) => [column.name, column.needed, column.help, EXAMPLE[column.name] ?? ''])]);
  help['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 60 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(book, help, 'Help');

  const allowed = allowedValues(catalog);
  const allowedNames = Object.keys(allowed);
  const depth = Math.max(...Object.values(allowed).map((values) => values.length));
  const rows = Array.from({ length: depth }, (_, index) => allowedNames.map((name) => allowed[name][index] ?? ''));
  const values = XLSX.utils.aoa_to_sheet([allowedNames, ...rows]);
  values['!cols'] = allowedNames.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(book, values, 'Allowed Values');

  XLSX.writeFile(book, 'kpi-template.xlsx');
};

/**
 * The filled rows of an uploaded file, each with its row number in Excel. Throws a readable message for a wrong file.
 */
export const readKpiFile = async (file) => {
  const book = XLSX.read(await file.arrayBuffer());
  const sheet = book.Sheets[SHEET_NAME] ?? book.Sheets[book.SheetNames[0]];
  const [headers = []] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const missing = REQUIRED_HEADERS.filter((name) => !headers.map((header) => String(header).trim()).includes(name));
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
export const rowToKpi = (cells, { themes, objectives, frequencies, units, currencies, scales }) => {
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

  ['Code', 'Name', 'Description', 'Theme', 'Strategic Objective', 'Reporting Frequency', 'Measurement Type', 'Direction'].forEach(required);
  copy('Code', 'code');
  copy('Name', 'name');
  copy('Description', 'description');

  const theme = cells.Theme && findBy(themes.filter((candidate) => candidate.isActive), cells.Theme, 'name');
  if (cells.Theme && !theme) errors.push(`Theme "${cells.Theme}" was not found in the theme list`);
  if (theme) {
    const subThemes = flattenThemes(theme.children).filter((sub) => sub.isActive);
    const subTheme = cells['Sub-Theme'] && findBy(subThemes, cells['Sub-Theme'], 'name');
    if (cells['Sub-Theme'] && !subTheme) errors.push(`Sub-Theme "${cells['Sub-Theme']}" is not under theme "${theme.name}"`);
    if (!cells['Sub-Theme'] && subThemes.length > 0) errors.push(`Theme "${theme.name}" has sub-themes, so choose one`);
    values.themeId = subTheme?.id ?? theme.id;
  }

  match('Strategic Objective', 'strategicObjectiveId', (text) => findBy(objectives.filter((objective) => objective.isActive), text, 'code', 'name')?.id);
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
