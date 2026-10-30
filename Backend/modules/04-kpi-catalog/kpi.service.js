import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseBooleanQuery, parseEnum, parseNumber, parseUuid } from '../../utils/validation.js';
import { getSetting } from '../10-system-governance/system.service.js';

/**
 * Module 04 — Master KPI catalog.
 * A KPI is not tied to a year: it reaches a year through an assignment on that year's contract.
 * It locks once it has a live assignment. A real change then means a new KPI with replacesKpiId, which keeps the
 * trend connected and retires the old KPI.
 */

const MEASUREMENT_TYPES = ['NUMBER', 'PERCENTAGE', 'RATIO', 'STAGE', 'CATEGORY', 'MONEY'];
const DIRECTIONS = ['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'MAINTAIN'];
const TARGET_TYPES = ['MINIMUM', 'MAXIMUM', 'EXACT'];
const SCORING_METHODS = ['IMPROVEMENT', 'TARGET'];
const ZERO_TARGET_RULES = ['NOT_CALCULABLE', 'FULL_IF_MET'];

// Which methods make sense per measurement type (SRS 7, 8.2). The first one is the default.
const RULES_BY_TYPE = {
  NUMBER: { aggregation: ['SUM', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['SUM', 'LATEST', 'AVERAGE'] },
  MONEY: { aggregation: ['SUM', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['SUM', 'LATEST', 'AVERAGE'] },
  PERCENTAGE: { aggregation: ['RATIO_OF_SUMS', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['RATIO_OF_SUMS', 'LATEST'] },
  RATIO: { aggregation: ['RATIO_OF_SUMS', 'WEIGHTED_SCORE', 'SHARE_MEETING_TARGET', 'DIRECT'], rollup: ['RATIO_OF_SUMS', 'LATEST'] },
  STAGE: { aggregation: ['SHARE_MEETING_TARGET', 'STAGE_DISTRIBUTION', 'WEAKEST_LINK', 'WEIGHTED_SCORE', 'DIRECT'], rollup: ['LATEST'] },
  CATEGORY: { aggregation: ['SHARE_MEETING_TARGET', 'STAGE_DISTRIBUTION', 'WEAKEST_LINK', 'WEIGHTED_SCORE', 'DIRECT'], rollup: ['LATEST'] },
};
const ADDITIVE_TYPES = ['NUMBER', 'MONEY'];
const SCALE_TYPES = { STAGE: 'STAGE', CATEGORY: 'CATEGORY' };
const DEFAULT_TARGET_TYPE = { HIGHER_IS_BETTER: 'MINIMUM', LOWER_IS_BETTER: 'MAXIMUM', MAINTAIN: 'EXACT' };

// Cancelled or rejected assignments never took effect, so they do not lock a KPI.
const LIVE_ASSIGNMENT = { status: { notIn: ['CANCELLED', 'REJECTED'] } };

// What may still change on a locked KPI; everything else defines what past results mean.
const EDITABLE_WHEN_LOCKED = new Set(['isActive', 'coordinatingOfficeId', 'defaultFrequencyId']);

const REF_SELECT = { id: true, code: true, name: true };
const KPI_INCLUDE = {
  theme: { select: REF_SELECT },
  strategicObjective: { select: REF_SELECT },
  unit: { select: { id: true, name: true, symbol: true } },
  scale: { select: { id: true, name: true, scaleType: true, isBinary: true, scoringApproved: true } },
  currency: { select: { id: true, code: true, symbol: true } },
  defaultFrequency: { select: { id: true, name: true, intervalMonths: true } },
  coordinatingOffice: { select: REF_SELECT },
  replaces: { select: REF_SELECT },
  replacedBy: { select: REF_SELECT },
  _count: { select: { assignments: { where: LIVE_ASSIGNMENT } } },
};

const formatKpi = ({ _count, ...kpi }) => ({ ...kpi, liveAssignmentCount: _count.assignments, isLocked: _count.assignments > 0 });

const assertGlobal = (actor, code, what) => {
  if (!actor.access.canGlobally(code)) throw forbidden(`${what} requires university-wide ${code} authority`);
};

/**
 * Convert request fields to column values. Only fields present in the input are returned.
 */
const parseKpiInput = (input) => {
  const fields = {};
  const set = (key, parse) => {
    if (input[key] !== undefined) fields[key] = parse(input[key], key);
  };
  const uuidOrNull = (value, key) => parseUuid(value, key, { required: false }) ?? null;
  const text = (value, key) => optionalString(value, key);
  const oneOf = (values) => (value, key) => parseEnum(value, key, values);

  set('code', (value, key) => text(value, key)?.toUpperCase() ?? null);
  ['name', 'description', 'numeratorLabel', 'denominatorLabel', 'formula', 'dataSource', 'evidenceRequirement'].forEach((key) => set(key, text));
  ['themeId', 'strategicObjectiveId', 'unitId', 'scaleId', 'currencyId', 'defaultFrequencyId', 'coordinatingOfficeId'].forEach((key) => set(key, uuidOrNull));
  set('measurementType', oneOf(MEASUREMENT_TYPES));
  set('direction', oneOf(DIRECTIONS));
  set('targetType', oneOf(TARGET_TYPES));
  set('aggregationMethod', (value, key) => parseEnum(value, key, [...new Set(Object.values(RULES_BY_TYPE).flatMap((rules) => rules.aggregation))]));
  set('periodRollupMethod', (value, key) => parseEnum(value, key, [...new Set(Object.values(RULES_BY_TYPE).flatMap((rules) => rules.rollup))]));
  set('scoringMethod', oneOf(SCORING_METHODS));
  set('zeroTargetRule', oneOf(ZERO_TARGET_RULES));
  set('isAdditive', parseBoolean);
  set('isActive', parseBoolean);
  set('decimalPlaces', (value, key) => parseNumber(value, key, { integer: true }));
  set('maintenanceTolerance', (value, key) => parseNumber(value, key) ?? null);
  return fields;
};

/**
 * Check a complete KPI definition against SRS 3.2 and 17. Returns the related scale for further use.
 * Every problem is reported at once.
 */
const validateDefinition = async (kpi) => {
  const errors = [];
  for (const key of ['code', 'name', 'description', 'themeId', 'strategicObjectiveId', 'measurementType', 'direction', 'defaultFrequencyId', 'dataSource', 'evidenceRequirement']) {
    if (kpi[key] === undefined || kpi[key] === null) errors.push(`${key} is required`);
  }
  const rules = RULES_BY_TYPE[kpi.measurementType];
  if (!rules) throw badRequest('Some fields are invalid', { errors });

  const type = kpi.measurementType;
  if (!rules.aggregation.includes(kpi.aggregationMethod)) errors.push(`aggregationMethod for ${type} must be one of: ${rules.aggregation.join(', ')}`);
  if (!rules.rollup.includes(kpi.periodRollupMethod)) errors.push(`periodRollupMethod for ${type} must be one of: ${rules.rollup.join(', ')}`);

  if (kpi.isAdditive && !ADDITIVE_TYPES.includes(type)) errors.push(`A ${type} KPI cannot be additive`);
  if (kpi.aggregationMethod === 'SUM' && !kpi.isAdditive) errors.push('aggregationMethod SUM needs isAdditive true');

  if (type === 'PERCENTAGE' || type === 'RATIO') {
    if (!kpi.numeratorLabel || !kpi.denominatorLabel) errors.push(`A ${type} KPI needs numeratorLabel and denominatorLabel`);
  }
  if (type === 'MONEY' && !kpi.currencyId) errors.push('A MONEY KPI needs currencyId');
  if (type !== 'MONEY' && kpi.currencyId) errors.push(`A ${type} KPI cannot have a currency`);
  if (SCALE_TYPES[type] && !kpi.scaleId) errors.push(`A ${type} KPI needs scaleId`);
  if (!SCALE_TYPES[type] && kpi.scaleId) errors.push(`A ${type} KPI cannot have a scale`);
  if (type === 'NUMBER' && !kpi.unitId) errors.push('A NUMBER KPI needs unitId');

  if (kpi.direction === 'MAINTAIN' && kpi.maintenanceTolerance === null) errors.push('A MAINTAIN KPI needs maintenanceTolerance');
  if (kpi.maintenanceTolerance !== null && kpi.maintenanceTolerance < 0) errors.push('maintenanceTolerance cannot be negative');
  if (kpi.direction === 'HIGHER_IS_BETTER' && kpi.targetType === 'MAXIMUM') errors.push('A higher-is-better KPI cannot use a MAXIMUM target');
  if (kpi.direction === 'LOWER_IS_BETTER' && kpi.targetType === 'MINIMUM') errors.push('A lower-is-better KPI cannot use a MINIMUM target');
  if (kpi.direction === 'MAINTAIN' && kpi.targetType !== 'EXACT') errors.push('A MAINTAIN KPI must use an EXACT target');
  if (kpi.decimalPlaces < 0 || kpi.decimalPlaces > 6) errors.push('decimalPlaces must be between 0 and 6');

  // Related records must exist and be usable
  const [theme, objective, unit, scale, currency, frequency, office] = await Promise.all([
    kpi.themeId ? prisma.kpiTheme.findUnique({ where: { id: kpi.themeId } }) : null,
    kpi.strategicObjectiveId ? prisma.strategicObjective.findUnique({ where: { id: kpi.strategicObjectiveId } }) : null,
    kpi.unitId ? prisma.measurementUnit.findUnique({ where: { id: kpi.unitId } }) : null,
    kpi.scaleId ? prisma.kpiScale.findUnique({ where: { id: kpi.scaleId } }) : null,
    kpi.currencyId ? prisma.currency.findUnique({ where: { id: kpi.currencyId } }) : null,
    kpi.defaultFrequencyId ? prisma.reportingFrequency.findUnique({ where: { id: kpi.defaultFrequencyId } }) : null,
    kpi.coordinatingOfficeId ? prisma.office.findUnique({ where: { id: kpi.coordinatingOfficeId } }) : null,
  ]);
  if (kpi.themeId && !theme?.isActive) errors.push('themeId must point to an active theme');
  if (kpi.strategicObjectiveId && !objective?.isActive) errors.push('strategicObjectiveId must point to an active strategic objective');
  if (kpi.unitId && !unit) errors.push('Unit not found');
  if (kpi.currencyId && !currency) errors.push('Currency not found');
  if (kpi.defaultFrequencyId && !frequency) errors.push('Reporting frequency not found');
  if (kpi.coordinatingOfficeId && !office?.isActive) errors.push('coordinatingOfficeId must point to an active office');

  if (kpi.scaleId) {
    if (!scale) errors.push('Scale not found');
    else {
      if (scale.scaleType !== SCALE_TYPES[type]) errors.push(`A ${type} KPI needs a ${SCALE_TYPES[type]} scale`);
      // Numerical progress on a stage or category needs approved scores (SRS 7.4, 17.12)
      if (kpi.scoringMethod === 'IMPROVEMENT' && !scale.scoringApproved) errors.push(`IMPROVEMENT scoring needs a scale with approved scoring; "${scale.name}" has none`);
      if (kpi.aggregationMethod === 'WEIGHTED_SCORE' && !scale.scoringApproved) errors.push(`WEIGHTED_SCORE needs a scale with approved scoring; "${scale.name}" has none`);
    }
  }

  if (errors.length > 0) throw badRequest('Some fields are invalid', { errors });
};

// ===== Queries =====

export const listKpis = async ({ search, themeId, strategicObjectiveId, measurementType, direction, isActive, page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const active = parseBooleanQuery(isActive, 'isActive');
  const where = {
    ...(themeId && { themeId: parseUuid(themeId, 'themeId') }),
    ...(strategicObjectiveId && { strategicObjectiveId: parseUuid(strategicObjectiveId, 'strategicObjectiveId') }),
    ...(measurementType && { measurementType: parseEnum(measurementType, 'measurementType', MEASUREMENT_TYPES) }),
    ...(direction && { direction: parseEnum(direction, 'direction', DIRECTIONS) }),
    ...(active !== undefined && { isActive: active }),
  };
  if (search?.trim()) {
    where.OR = [{ code: { contains: search.trim(), mode: 'insensitive' } }, { name: { contains: search.trim(), mode: 'insensitive' } }];
  }

  const [total, kpis] = await Promise.all([
    prisma.kpi.count({ where }),
    prisma.kpi.findMany({ where, orderBy: { code: 'asc' }, skip: (pageNum - 1) * limitNum, take: limitNum, include: KPI_INCLUDE }),
  ]);
  return { data: kpis.map(formatKpi), pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
};

export const getKpiById = async (id) => {
  const kpi = await prisma.kpi.findUnique({ where: { id: parseUuid(id, 'id') }, include: KPI_INCLUDE });
  if (!kpi) throw notFound('KPI not found');
  return formatKpi(kpi);
};

// ===== Changes =====

/**
 * Register a KPI. Methods left out get the usual choice for its measurement type; the scoring method defaults to
 * the university's official basis. With replacesKpiId the old KPI is retired in the same transaction.
 */
export const createKpi = async (data = {}, actor) => {
  assertGlobal(actor, PERMISSIONS.KPI_CREATE, 'Registering KPIs');
  const fields = parseKpiInput(data);
  const replacesKpiId = parseUuid(data.replacesKpiId, 'replacesKpiId', { required: false }) ?? null;
  const rules = RULES_BY_TYPE[fields.measurementType];

  const definition = {
    numeratorLabel: null,
    denominatorLabel: null,
    formula: null,
    unitId: null,
    scaleId: null,
    currencyId: null,
    coordinatingOfficeId: null,
    maintenanceTolerance: null,
    decimalPlaces: 2,
    zeroTargetRule: 'NOT_CALCULABLE',
    isActive: true,
    aggregationMethod: rules?.aggregation[0],
    periodRollupMethod: rules?.rollup[0],
    isAdditive: ADDITIVE_TYPES.includes(fields.measurementType),
    targetType: DEFAULT_TARGET_TYPE[fields.direction],
    scoringMethod: await getSetting('kpi', 'official_basis'),
    ...fields,
  };
  await validateDefinition(definition);

  if (await prisma.kpi.findUnique({ where: { code: definition.code } })) throw conflict(`KPI code "${definition.code}" is already used`);

  let replaced = null;
  if (replacesKpiId) {
    replaced = await prisma.kpi.findUnique({ where: { id: replacesKpiId }, include: { replacedBy: { select: { code: true } } } });
    if (!replaced) throw badRequest('The KPI to replace was not found');
    if (replaced.replacedBy.length > 0) throw conflict(`KPI ${replaced.code} was already replaced by ${replaced.replacedBy[0].code}`);
  }

  const kpi = await prisma.$transaction(async (tx) => {
    if (replaced) await tx.kpi.update({ where: { id: replaced.id }, data: { isActive: false } });
    return tx.kpi.create({ data: { ...definition, replacesKpiId, createdByPersonId: actor.personId }, include: KPI_INCLUDE });
  });

  const { _count, theme, strategicObjective, unit, scale, currency, defaultFrequency, coordinatingOffice, replaces, replacedBy, ...values } = kpi;
  await auditAction(actor, { action: replaced ? 'KPI_REPLACED' : 'KPI_CREATED', entityType: 'kpi', entityId: kpi.id, newValues: values });
  return formatKpi(kpi);
};

/**
 * Update a KPI. Once it is locked only isActive, coordinatingOfficeId and defaultFrequencyId can change.
 */
export const updateKpi = async (id, data = {}, actor) => {
  assertGlobal(actor, PERMISSIONS.KPI_UPDATE, 'Changing KPIs');
  const existing = await prisma.kpi.findUnique({
    where: { id: parseUuid(id, 'id') },
    include: { replacedBy: { select: { code: true } }, _count: { select: { assignments: { where: LIVE_ASSIGNMENT } } } },
  });
  if (!existing) throw notFound('KPI not found');
  const { _count, replacedBy, ...before } = existing;

  const fields = parseKpiInput(data);
  if (data.replacesKpiId !== undefined) throw badRequest('replacesKpiId is set only when registering the new KPI');
  if (Object.keys(fields).length === 0) throw badRequest('No updatable fields provided');

  if (_count.assignments > 0) {
    const same = (key) => String(fields[key] ?? '') === String(before[key] ?? '');
    const blocked = Object.keys(fields).filter((key) => !EDITABLE_WHEN_LOCKED.has(key) && !same(key));
    if (blocked.length > 0) {
      throw conflict(`KPI ${existing.code} is in use and locked, so these cannot change: ${blocked.join(', ')}. Register a new KPI with replacesKpiId instead`, { locked: blocked });
    }
  }
  if (fields.isActive === true && replacedBy.length > 0) throw conflict(`KPI ${existing.code} was replaced by ${replacedBy[0].code} and cannot be reactivated`);

  const merged = { ...before, ...fields, maintenanceTolerance: 'maintenanceTolerance' in fields ? fields.maintenanceTolerance : before.maintenanceTolerance === null ? null : Number(before.maintenanceTolerance) };
  await validateDefinition(merged);
  if (fields.code && fields.code !== existing.code && (await prisma.kpi.findUnique({ where: { code: fields.code } }))) {
    throw conflict(`KPI code "${fields.code}" is already used`);
  }

  const kpi = await prisma.kpi.update({ where: { id: existing.id }, data: fields, include: KPI_INCLUDE });
  await auditAction(actor, { action: 'KPI_UPDATED', entityType: 'kpi', entityId: existing.id, oldValues: before, newValues: fields });
  return formatKpi(kpi);
};

export default { listKpis, getKpiById, createKpi, updateKpi };
