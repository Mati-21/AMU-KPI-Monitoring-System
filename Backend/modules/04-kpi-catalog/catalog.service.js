import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseBooleanQuery, parseDate, parseIntId, parseNumber, parseUuid, requireString } from '../../utils/validation.js';

/**
 * Module 04 — What KPIs are built from: strategic objectives, themes, units, reporting frequencies,
 * stage/category scales, currencies and exchange rates. The university configures all of these.
 * A scale locks as soon as a KPI uses it; a real change means a new scale.
 */

const assertGlobal = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.KPI_MANAGE)) {
    throw forbidden('Changing the KPI catalog requires university-wide kpi:manage authority');
  }
};

const upperCode = (code) => (code ? code.toUpperCase() : code);

const findOrThrow = async (model, id, label, args = {}) => {
  const row = await model.findUnique({ where: { id: parseUuid(id, 'id') }, ...args });
  if (!row) throw notFound(`${label} not found`);
  return row;
};

const assertNameFree = async (model, name, label, exceptId) => {
  const existing = await model.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (existing && existing.id !== exceptId) throw conflict(`${label} "${existing.name}" already exists`);
};

// ===== Strategic objectives =====

export const listObjectives = async ({ isActive } = {}) => {
  const active = parseBooleanQuery(isActive, 'isActive');
  const objectives = await prisma.strategicObjective.findMany({
    where: active === undefined ? {} : { isActive: active },
    orderBy: { code: 'asc' },
    include: { _count: { select: { kpis: true } } },
  });
  return objectives.map(({ _count, ...objective }) => ({ ...objective, kpiCount: _count.kpis }));
};

export const createObjective = async ({ code, name, description } = {}, actor) => {
  assertGlobal(actor);
  const objective = await prisma.strategicObjective.create({
    data: { code: upperCode(requireString(code, 'code')), name: requireString(name, 'name'), description: optionalString(description, 'description') ?? null },
  });
  await auditAction(actor, { action: 'OBJECTIVE_CREATED', entityType: 'strategic_objective', entityId: objective.id, newValues: objective });
  return objective;
};

export const updateObjective = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.strategicObjective, id, 'Strategic objective');
  const update = {};
  if (data.code !== undefined) update.code = upperCode(requireString(data.code, 'code'));
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.description !== undefined) update.description = optionalString(data.description, 'description');
  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined) update.isActive = isActive;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const objective = await prisma.strategicObjective.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'OBJECTIVE_UPDATED', entityType: 'strategic_objective', entityId: existing.id, oldValues: existing, newValues: objective });
  return objective;
};

// ===== Themes =====

/**
 * The whole theme hierarchy with the number of KPIs directly under each theme.
 */
export const getThemeTree = async () => {
  const themes = await prisma.kpiTheme.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { kpis: true } } },
  });
  const nodes = new Map(themes.map(({ _count, ...theme }) => [theme.id, { ...theme, kpiCount: _count.kpis, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parentThemeId && nodes.get(node.parentThemeId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
};

export const createTheme = async ({ code, name, description, parentThemeId, sortOrder } = {}, actor) => {
  assertGlobal(actor);
  const parentId = parseUuid(parentThemeId, 'parentThemeId', { required: false });
  if (parentId) {
    const parent = await prisma.kpiTheme.findUnique({ where: { id: parentId } });
    if (!parent) throw badRequest('Parent theme not found');
    if (!parent.isActive) throw badRequest(`Parent theme "${parent.name}" is inactive`);
  }
  const theme = await prisma.kpiTheme.create({
    data: {
      code: upperCode(optionalString(code, 'code')) ?? null,
      name: requireString(name, 'name'),
      description: optionalString(description, 'description') ?? null,
      parentThemeId: parentId ?? null,
      sortOrder: parseNumber(sortOrder, 'sortOrder', { integer: true }) ?? 0,
    },
  });
  await auditAction(actor, { action: 'THEME_CREATED', entityType: 'kpi_theme', entityId: theme.id, newValues: theme });
  return theme;
};

export const updateTheme = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.kpiTheme, id, 'Theme');
  const update = {};
  if (data.code !== undefined) update.code = upperCode(optionalString(data.code, 'code'));
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.description !== undefined) update.description = optionalString(data.description, 'description');
  if (data.sortOrder !== undefined) update.sortOrder = parseNumber(data.sortOrder, 'sortOrder', { integer: true });

  if (data.parentThemeId !== undefined) {
    const parentId = parseUuid(data.parentThemeId, 'parentThemeId', { required: false }) ?? null;
    if (parentId) {
      // Walk up from the new parent: reaching this theme would create a cycle
      const themes = await prisma.kpiTheme.findMany({ select: { id: true, parentThemeId: true } });
      const parents = new Map(themes.map((theme) => [theme.id, theme.parentThemeId]));
      if (!parents.has(parentId)) throw badRequest('Parent theme not found');
      for (let current = parentId; current; current = parents.get(current)) {
        if (current === existing.id) throw badRequest('A theme cannot be moved under itself or one of its sub-themes');
      }
    }
    update.parentThemeId = parentId;
  }

  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined) {
    if (!isActive) {
      const [activeChildren, activeKpis] = await Promise.all([
        prisma.kpiTheme.count({ where: { parentThemeId: existing.id, isActive: true } }),
        prisma.kpi.count({ where: { themeId: existing.id, isActive: true } }),
      ]);
      if (activeChildren > 0 || activeKpis > 0) throw conflict('Deactivate or move the active sub-themes and KPIs first');
    }
    update.isActive = isActive;
  }
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const theme = await prisma.kpiTheme.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'THEME_UPDATED', entityType: 'kpi_theme', entityId: existing.id, oldValues: existing, newValues: theme });
  return theme;
};

// ===== Measurement units =====

export const listUnits = () => prisma.measurementUnit.findMany({ orderBy: { name: 'asc' } });

export const createUnit = async ({ name, symbol, description } = {}, actor) => {
  assertGlobal(actor);
  const cleanName = requireString(name, 'name');
  await assertNameFree(prisma.measurementUnit, cleanName, 'Unit');
  const unit = await prisma.measurementUnit.create({
    data: { name: cleanName, symbol: optionalString(symbol, 'symbol') ?? null, description: optionalString(description, 'description') ?? null },
  });
  await auditAction(actor, { action: 'UNIT_CREATED', entityType: 'measurement_unit', entityId: unit.id, newValues: unit });
  return unit;
};

/**
 * A unit that a KPI uses is part of that KPI's meaning, so it can no longer be changed.
 */
export const updateUnit = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.measurementUnit, id, 'Unit');
  if ((await prisma.kpi.count({ where: { unitId: existing.id } })) > 0) throw conflict(`Unit "${existing.name}" is used by a KPI and cannot be changed`);

  const update = {};
  if (data.name !== undefined) {
    update.name = requireString(data.name, 'name');
    await assertNameFree(prisma.measurementUnit, update.name, 'Unit', existing.id);
  }
  if (data.symbol !== undefined) update.symbol = optionalString(data.symbol, 'symbol');
  if (data.description !== undefined) update.description = optionalString(data.description, 'description');
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const unit = await prisma.measurementUnit.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'UNIT_UPDATED', entityType: 'measurement_unit', entityId: existing.id, oldValues: existing, newValues: unit });
  return unit;
};

// ===== Reporting frequencies =====

const parseFrequency = (intervalMonths, isCustom) => {
  const custom = parseBoolean(isCustom, 'isCustom') ?? false;
  if (custom) {
    if (intervalMonths !== undefined && intervalMonths !== null) throw badRequest('A custom frequency has no intervalMonths; its periods set their own dates');
    return { isCustom: true, intervalMonths: null };
  }
  const months = parseIntId(intervalMonths, 'intervalMonths');
  if (months > 12) throw badRequest('intervalMonths must be between 1 and 12');
  return { isCustom: false, intervalMonths: months };
};

export const listFrequencies = () => prisma.reportingFrequency.findMany({ orderBy: [{ isCustom: 'asc' }, { intervalMonths: 'asc' }] });

export const createFrequency = async ({ name, intervalMonths, isCustom } = {}, actor) => {
  assertGlobal(actor);
  const cleanName = requireString(name, 'name');
  await assertNameFree(prisma.reportingFrequency, cleanName, 'Reporting frequency');
  const frequency = await prisma.reportingFrequency.create({ data: { name: cleanName, ...parseFrequency(intervalMonths, isCustom) } });
  await auditAction(actor, { action: 'FREQUENCY_CREATED', entityType: 'reporting_frequency', entityId: frequency.id, newValues: frequency });
  return frequency;
};

/**
 * The interval can change only while no periods or assignments use the frequency. Renaming is always allowed.
 */
export const updateFrequency = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.reportingFrequency, id, 'Reporting frequency', {
    include: { _count: { select: { periods: true, assignments: true } } },
  });
  const { _count, ...before } = existing;

  const update = {};
  if (data.name !== undefined) {
    update.name = requireString(data.name, 'name');
    await assertNameFree(prisma.reportingFrequency, update.name, 'Reporting frequency', existing.id);
  }
  if (data.intervalMonths !== undefined || data.isCustom !== undefined) {
    if (_count.periods > 0 || _count.assignments > 0) throw conflict(`"${existing.name}" is in use, so its interval cannot change. Create a new frequency instead`);
    Object.assign(update, parseFrequency(data.intervalMonths ?? before.intervalMonths, data.isCustom ?? before.isCustom));
  }
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const frequency = await prisma.reportingFrequency.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'FREQUENCY_UPDATED', entityType: 'reporting_frequency', entityId: existing.id, oldValues: before, newValues: frequency });
  return frequency;
};

// ===== Stage and category scales =====

const SCALE_INCLUDE = {
  levels: { orderBy: { sortOrder: 'asc' } },
  _count: { select: { kpis: true } },
};

const formatScale = ({ _count, ...scale }) => ({ ...scale, kpiCount: _count.kpis, isLocked: _count.kpis > 0 });

/**
 * Validate a full level list: at least two distinct names and orders.
 * Stages must carry assessment criteria (SRS 7.4); a binary scale has exactly two levels.
 */
const parseLevels = (levels, { scaleType, isBinary }) => {
  if (!Array.isArray(levels) || levels.length < 2) throw badRequest('levels must list at least two levels');
  if (isBinary && levels.length !== 2) throw badRequest('A binary scale has exactly two levels');

  const parsed = levels.map((level, index) => {
    const name = requireString(level?.name, `levels[${index}].name`);
    const assessmentCriteria = optionalString(level?.assessmentCriteria, `levels[${index}].assessmentCriteria`) ?? null;
    if (scaleType === 'STAGE' && !assessmentCriteria) throw badRequest(`Stage "${name}" needs assessmentCriteria`);
    return {
      name,
      description: optionalString(level?.description, `levels[${index}].description`) ?? null,
      sortOrder: parseNumber(level?.sortOrder, `levels[${index}].sortOrder`, { integer: true }) ?? index + 1,
      score: parseNumber(level?.score, `levels[${index}].score`) ?? null,
      assessmentCriteria,
    };
  });
  if (new Set(parsed.map((level) => level.name.toLowerCase())).size !== parsed.length) throw badRequest('Level names must be unique');
  if (new Set(parsed.map((level) => level.sortOrder)).size !== parsed.length) throw badRequest('Level sortOrder values must be unique');
  return parsed;
};

const parseScaleFlags = (scaleType, isOrdered, isBinary) => {
  if (scaleType !== 'STAGE' && scaleType !== 'CATEGORY') throw badRequest('scaleType must be STAGE or CATEGORY');
  const binary = parseBoolean(isBinary, 'isBinary') ?? false;
  const ordered = parseBoolean(isOrdered, 'isOrdered') ?? !binary;
  if (scaleType === 'STAGE' && (!ordered || binary)) throw badRequest('A stage scale must be ordered and cannot be binary');
  return { scaleType, isOrdered: ordered, isBinary: binary };
};

export const listScales = async ({ scaleType } = {}) => {
  const scales = await prisma.kpiScale.findMany({ where: scaleType ? { scaleType } : {}, orderBy: { name: 'asc' }, include: SCALE_INCLUDE });
  return scales.map(formatScale);
};

export const getScaleById = async (id) => formatScale(await findOrThrow(prisma.kpiScale, id, 'Scale', { include: SCALE_INCLUDE }));

export const createScale = async ({ name, scaleType, isOrdered, isBinary, levels } = {}, actor) => {
  assertGlobal(actor);
  const cleanName = requireString(name, 'name');
  await assertNameFree(prisma.kpiScale, cleanName, 'Scale');
  const flags = parseScaleFlags(scaleType, isOrdered, isBinary);
  const parsedLevels = parseLevels(levels, flags);

  const scale = await prisma.kpiScale.create({
    data: { name: cleanName, ...flags, levels: { create: parsedLevels } },
    include: SCALE_INCLUDE,
  });
  await auditAction(actor, { action: 'SCALE_CREATED', entityType: 'kpi_scale', entityId: scale.id, newValues: { name: scale.name, ...flags, levels: parsedLevels } });
  return formatScale(scale);
};

/**
 * Replace a scale's definition and levels. Refused once a KPI uses it.
 * Any change withdraws scoring approval, since what was approved has changed.
 */
export const updateScale = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.kpiScale, id, 'Scale', { include: SCALE_INCLUDE });
  if (existing._count.kpis > 0) throw conflict(`Scale "${existing.name}" is used by a KPI and is locked. Create a new scale instead`);

  const name = data.name === undefined ? existing.name : requireString(data.name, 'name');
  await assertNameFree(prisma.kpiScale, name, 'Scale', existing.id);
  const flags = parseScaleFlags(data.scaleType ?? existing.scaleType, data.isOrdered ?? existing.isOrdered, data.isBinary ?? existing.isBinary);
  const currentLevels = existing.levels.map(({ id: _id, scaleId: _scaleId, score, ...level }) => ({ ...level, score: score === null ? null : Number(score) }));
  const levels = parseLevels(data.levels ?? currentLevels, flags);

  const scale = await prisma.$transaction(async (tx) => {
    await tx.kpiScaleLevel.deleteMany({ where: { scaleId: existing.id } });
    return tx.kpiScale.update({
      where: { id: existing.id },
      data: { name, ...flags, scoringApproved: false, approvedByPersonId: null, approvedAt: null, levels: { create: levels } },
      include: SCALE_INCLUDE,
    });
  });
  await auditAction(actor, {
    action: 'SCALE_UPDATED',
    entityType: 'kpi_scale',
    entityId: existing.id,
    oldValues: { name: existing.name, scaleType: existing.scaleType, levels: existing.levels },
    newValues: { name, ...flags, levels },
  });
  return formatScale(scale);
};

/**
 * Approve numerical scoring (SRS 7.4, 7.5). Every level needs a score and the scores must follow the level order,
 * rising or falling. Binary scales cannot be scored: a Yes/No has no fractional progress.
 * Approval is one-way once a KPI uses the scale.
 */
export const setScaleScoring = async (id, { approved } = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.kpiScale, id, 'Scale', { include: SCALE_INCLUDE });
  const approve = parseBoolean(approved, 'approved');
  if (approve === undefined) throw badRequest('approved (boolean) is required');

  if (approve) {
    if (existing.isBinary) throw badRequest('A binary scale cannot have numerical scoring');
    if (!existing.isOrdered) throw badRequest('Only an ordered scale can have numerical scoring');
    const missing = existing.levels.filter((level) => level.score === null).map((level) => level.name);
    if (missing.length > 0) throw badRequest(`These levels have no score: ${missing.join(', ')}`);
    if (existing.scaleType === 'STAGE') {
      const noCriteria = existing.levels.filter((level) => !level.assessmentCriteria).map((level) => level.name);
      if (noCriteria.length > 0) throw badRequest(`These stages have no assessment criteria: ${noCriteria.join(', ')}`);
    }
    const scores = existing.levels.map((level) => Number(level.score));
    const steps = scores.slice(1).map((score, index) => score - scores[index]);
    if (!steps.every((step) => step > 0) && !steps.every((step) => step < 0)) {
      throw badRequest('Scores must rise or fall steadily with the level order');
    }
  } else if (existing._count.kpis > 0) {
    throw conflict(`Scale "${existing.name}" is used by a KPI, so its scoring approval cannot be withdrawn`);
  }

  const scale = await prisma.kpiScale.update({
    where: { id: existing.id },
    data: { scoringApproved: approve, approvedByPersonId: approve ? actor.personId : null, approvedAt: approve ? new Date() : null },
    include: SCALE_INCLUDE,
  });
  await auditAction(actor, {
    action: approve ? 'SCALE_SCORING_APPROVED' : 'SCALE_SCORING_WITHDRAWN',
    entityType: 'kpi_scale',
    entityId: existing.id,
    oldValues: { scoringApproved: existing.scoringApproved },
    newValues: { scoringApproved: approve },
  });
  return formatScale(scale);
};

// ===== Currencies and exchange rates =====

const parseCurrencyCode = (code) => {
  const clean = requireString(code, 'code').toUpperCase();
  if (!/^[A-Z]{3}$/.test(clean)) throw badRequest('code must be a 3-letter currency code');
  return clean;
};

export const listCurrencies = () => prisma.currency.findMany({ orderBy: [{ isReportingCurrency: 'desc' }, { code: 'asc' }] });

export const createCurrency = async ({ code, name, symbol, isReportingCurrency } = {}, actor) => {
  assertGlobal(actor);
  const reporting = parseBoolean(isReportingCurrency, 'isReportingCurrency') ?? false;
  const data = {
    code: parseCurrencyCode(code),
    name: requireString(name, 'name'),
    symbol: optionalString(symbol, 'symbol') ?? null,
    isReportingCurrency: reporting,
  };
  const currency = await prisma.$transaction(async (tx) => {
    if (reporting) await tx.currency.updateMany({ where: { isReportingCurrency: true }, data: { isReportingCurrency: false } });
    return tx.currency.create({ data });
  });
  await auditAction(actor, { action: 'CURRENCY_CREATED', entityType: 'currency', entityId: currency.id, newValues: currency });
  return currency;
};

/**
 * isReportingCurrency: true moves the flag here from the current reporting currency.
 * To change it, choose another currency; there must always be one once set.
 */
export const updateCurrency = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await findOrThrow(prisma.currency, id, 'Currency');
  const update = {};
  if (data.code !== undefined && parseCurrencyCode(data.code) !== existing.code) {
    if ((await prisma.kpi.count({ where: { currencyId: existing.id } })) > 0) throw conflict(`Currency ${existing.code} is used by a KPI, so its code cannot change`);
    update.code = parseCurrencyCode(data.code);
  }
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.symbol !== undefined) update.symbol = optionalString(data.symbol, 'symbol');

  const reporting = parseBoolean(data.isReportingCurrency, 'isReportingCurrency');
  if (reporting === false && existing.isReportingCurrency) throw badRequest('Choose another reporting currency instead of clearing this one');
  if (reporting === true) update.isReportingCurrency = true;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const currency = await prisma.$transaction(async (tx) => {
    if (reporting === true) await tx.currency.updateMany({ where: { isReportingCurrency: true, id: { not: existing.id } }, data: { isReportingCurrency: false } });
    return tx.currency.update({ where: { id: existing.id }, data: update });
  });
  await auditAction(actor, { action: 'CURRENCY_UPDATED', entityType: 'currency', entityId: existing.id, oldValues: existing, newValues: currency });
  return currency;
};

const RATE_INCLUDE = {
  fromCurrency: { select: { id: true, code: true } },
  toCurrency: { select: { id: true, code: true } },
};

export const listExchangeRates = async ({ fromCurrencyId, toCurrencyId } = {}) =>
  prisma.exchangeRate.findMany({
    where: {
      ...(fromCurrencyId && { fromCurrencyId: parseUuid(fromCurrencyId, 'fromCurrencyId') }),
      ...(toCurrencyId && { toCurrencyId: parseUuid(toCurrencyId, 'toCurrencyId') }),
    },
    orderBy: { rateDate: 'desc' },
    include: RATE_INCLUDE,
  });

/**
 * Rates are never edited: reported values point at the rate they were converted with.
 */
export const createExchangeRate = async ({ fromCurrencyId, toCurrencyId, rate, rateDate, source } = {}, actor) => {
  assertGlobal(actor);
  const from = parseUuid(fromCurrencyId, 'fromCurrencyId');
  const to = parseUuid(toCurrencyId, 'toCurrencyId');
  if (from === to) throw badRequest('fromCurrencyId and toCurrencyId must differ');
  const value = parseNumber(rate, 'rate', { required: true });
  if (value <= 0) throw badRequest('rate must be greater than 0');

  const found = await prisma.currency.count({ where: { id: { in: [from, to] } } });
  if (found !== 2) throw badRequest('Currency not found');

  const exchangeRate = await prisma.exchangeRate.create({
    data: { fromCurrencyId: from, toCurrencyId: to, rate: value, rateDate: parseDate(rateDate, 'rateDate'), source: optionalString(source, 'source') ?? null },
    include: RATE_INCLUDE,
  });
  await auditAction(actor, { action: 'EXCHANGE_RATE_CREATED', entityType: 'exchange_rate', entityId: exchangeRate.id, newValues: exchangeRate });
  return exchangeRate;
};

export default {
  listObjectives,
  createObjective,
  updateObjective,
  getThemeTree,
  createTheme,
  updateTheme,
  listUnits,
  createUnit,
  updateUnit,
  listFrequencies,
  createFrequency,
  updateFrequency,
  listScales,
  getScaleById,
  createScale,
  updateScale,
  setScaleScoring,
  listCurrencies,
  createCurrency,
  updateCurrency,
  listExchangeRates,
  createExchangeRate,
};
