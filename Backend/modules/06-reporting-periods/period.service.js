import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseBooleanQuery, parseDate, parseUuid, requireString } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { getSetting } from '../10-system-governance/system.service.js';
import { buildPeriods, defaultDeadline, periodPhase } from './period.rules.js';

/**
 * Module 06 — Reporting periods: when offices report, per fiscal year and frequency.
 * The period flagged isYearEnd takes the year's final report, where shorter periods roll up.
 */

const PERIOD_INCLUDE = {
  fiscalYear: { select: { id: true, name: true, status: true } },
  frequency: { select: { id: true, name: true, intervalMonths: true, isCustom: true } },
};

const formatPeriod = (period, today = startOfTodayUtc()) => ({ ...period, phase: periodPhase(period, today) });

const assertCanManage = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.PERIOD_MANAGE)) {
    throw forbidden('Managing reporting periods requires university-wide period:manage authority');
  }
};

const getPeriodOrThrow = async (id) => {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: parseUuid(id, 'id') }, include: PERIOD_INCLUDE });
  if (!period) throw notFound('Reporting period not found');
  return period;
};

const getFrequencyOrThrow = async (id) => {
  const frequency = await prisma.reportingFrequency.findUnique({ where: { id: parseUuid(id, 'frequencyId') } });
  if (!frequency) throw badRequest('Reporting frequency not found');
  return frequency;
};

const audit = (actor, action, period, { oldValues, newValues, reason } = {}) =>
  auditAction(actor, { action, entityType: 'reporting_period', entityId: period.id, oldValues, newValues, reason });

// ===== Checks =====

const assertDatesValid = (year, { startDate, endDate, submissionDeadline }) => {
  if (endDate < startDate) throw badRequest('endDate must be on or after startDate');
  if (startDate < year.startDate || endDate > year.endDate) throw badRequest(`The period must fall inside fiscal year "${year.name}"`);
  if (submissionDeadline && submissionDeadline < endDate) throw badRequest('submissionDeadline cannot be before the period ends');
};

const assertNoOverlap = async ({ fiscalYearId, frequencyId, startDate, endDate }, exceptId) => {
  const overlapping = await prisma.reportingPeriod.findFirst({
    where: { fiscalYearId, frequencyId, startDate: { lte: endDate }, endDate: { gte: startDate }, ...(exceptId && { id: { not: exceptId } }) },
  });
  if (overlapping) throw conflict(`These dates overlap period "${overlapping.name}" of the same frequency`);
};

/**
 * Only one year-end period per year, and it must run to the year's last day.
 */
const assertYearEndValid = async (year, { isYearEnd, endDate }, exceptId) => {
  if (!isYearEnd) return;
  if (endDate.getTime() !== year.endDate.getTime()) throw badRequest("The year-end period must end on the fiscal year's last day");
  const existing = await prisma.reportingPeriod.findFirst({ where: { fiscalYearId: year.id, isYearEnd: true, ...(exceptId && { id: { not: exceptId } }) } });
  if (existing) throw conflict(`"${existing.name}" is already the year-end period`);
};

const usageOf = (periodId) =>
  Promise.all([
    prisma.performanceReport.count({ where: { reportingPeriodId: periodId } }),
    prisma.kpiAchievement.count({ where: { reportingPeriodId: periodId } }),
    prisma.contractScore.count({ where: { reportingPeriodId: periodId } }),
    prisma.kpiBaseline.count({ where: { effectiveFromPeriodId: periodId } }),
    prisma.kpiTarget.count({ where: { effectiveFromPeriodId: periodId } }),
  ]).then((counts) => counts.reduce((sum, count) => sum + count, 0));

/**
 * Guard for writes to period data, such as report submissions (Module 07).
 */
export const assertPeriodOpen = async (periodId) => {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw notFound('Reporting period not found');
  if (period.isClosed) throw conflict(`Reporting period "${period.name}" is closed`);
  await assertFiscalYearOpen(period.fiscalYearId);
  return period;
};

// ===== Queries =====

export const listPeriods = async ({ fiscalYearId, frequencyId, isClosed } = {}) => {
  const closed = parseBooleanQuery(isClosed, 'isClosed');
  const periods = await prisma.reportingPeriod.findMany({
    where: {
      ...(fiscalYearId && { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') }),
      ...(frequencyId && { frequencyId: parseUuid(frequencyId, 'frequencyId') }),
      ...(closed !== undefined && { isClosed: closed }),
    },
    orderBy: [{ startDate: 'asc' }, { endDate: 'asc' }],
    include: PERIOD_INCLUDE,
  });
  const today = startOfTodayUtc();
  return periods.map((period) => formatPeriod(period, today));
};

export const getPeriodById = async (id) => formatPeriod(await getPeriodOrThrow(id));

// ===== Create =====

/**
 * Create one period by hand, for custom frequencies or irregular dates.
 * The deadline defaults to the period's end plus the setting reporting.submission_window_days.
 */
export const createPeriod = async ({ fiscalYearId, frequencyId, name, startDate, endDate, submissionDeadline, isYearEnd } = {}, actor) => {
  assertCanManage(actor);
  const year = await assertFiscalYearOpen(parseUuid(fiscalYearId, 'fiscalYearId'));
  const frequency = await getFrequencyOrThrow(frequencyId);

  const data = {
    fiscalYearId: year.id,
    frequencyId: frequency.id,
    name: requireString(name, 'name'),
    startDate: parseDate(startDate, 'startDate'),
    endDate: parseDate(endDate, 'endDate'),
    isYearEnd: parseBoolean(isYearEnd, 'isYearEnd') ?? false,
  };
  data.submissionDeadline = parseDate(submissionDeadline, 'submissionDeadline', { required: false }) ?? defaultDeadline(data.endDate, await getSetting('reporting', 'submission_window_days'));

  assertDatesValid(year, data);
  await assertNoOverlap(data);
  await assertYearEndValid(year, data);

  const period = await prisma.reportingPeriod.create({ data, include: PERIOD_INCLUDE });
  await audit(actor, 'PERIOD_CREATED', period, { newValues: data });
  return formatPeriod(period);
};

/**
 * Create all periods of one frequency for a fiscal year, for example Q1 to Q4.
 */
export const generatePeriods = async (fiscalYearId, { frequencyId } = {}, actor) => {
  assertCanManage(actor);
  const year = await assertFiscalYearOpen(parseUuid(fiscalYearId, 'id'));
  const frequency = await getFrequencyOrThrow(frequencyId);
  if (frequency.isCustom) throw badRequest('A custom frequency has no fixed interval. Create its periods one by one');

  const existing = await prisma.reportingPeriod.count({ where: { fiscalYearId: year.id, frequencyId: frequency.id } });
  if (existing > 0) throw conflict(`"${frequency.name}" periods already exist for fiscal year "${year.name}"`);

  const periods = buildPeriods(year, frequency.intervalMonths, await getSetting('reporting', 'submission_window_days'));
  const yearEnd = periods.find((period) => period.isYearEnd);
  if (yearEnd) await assertYearEndValid(year, yearEnd);

  await prisma.reportingPeriod.createMany({ data: periods.map((period) => ({ ...period, fiscalYearId: year.id, frequencyId: frequency.id })) });
  await auditAction(actor, {
    action: 'PERIODS_GENERATED',
    entityType: 'fiscal_year',
    entityId: year.id,
    newValues: { frequency: frequency.name, periods: periods.map((period) => period.name) },
  });
  return listPeriods({ fiscalYearId: year.id, frequencyId: frequency.id });
};

// ===== Change =====

/**
 * Change a period. The deadline can move at any time while it is open.
 * Name, dates and the year-end flag are fixed once reports or results depend on the period.
 */
export const updatePeriod = async (id, data = {}, actor) => {
  assertCanManage(actor);
  const existing = await getPeriodOrThrow(id);
  const year = await assertFiscalYearOpen(existing.fiscalYearId);
  if (existing.isClosed) throw conflict(`Reporting period "${existing.name}" is closed`);

  const update = {};
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.startDate !== undefined) update.startDate = parseDate(data.startDate, 'startDate');
  if (data.endDate !== undefined) update.endDate = parseDate(data.endDate, 'endDate');
  if (data.submissionDeadline !== undefined) update.submissionDeadline = parseDate(data.submissionDeadline, 'submissionDeadline', { required: false });
  const isYearEnd = parseBoolean(data.isYearEnd, 'isYearEnd');
  if (isYearEnd !== undefined) update.isYearEnd = isYearEnd;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const changesDefinition = Object.keys(update).some((key) => key !== 'submissionDeadline');
  if (changesDefinition && (await usageOf(existing.id)) > 0) {
    throw conflict('Reports or results depend on this period, so only its deadline can change');
  }

  const merged = { ...existing, ...update };
  assertDatesValid(year, merged);
  await assertNoOverlap(merged, existing.id);
  await assertYearEndValid(year, merged, existing.id);

  const period = await prisma.reportingPeriod.update({ where: { id: existing.id }, data: update, include: PERIOD_INCLUDE });
  const { fiscalYear: _year, frequency: _frequency, ...before } = existing;
  await audit(actor, 'PERIOD_UPDATED', period, { oldValues: before, newValues: update });
  return formatPeriod(period);
};

export const closePeriod = async (id, { reason } = {}, actor) => {
  assertCanManage(actor);
  const existing = await getPeriodOrThrow(id);
  await assertFiscalYearOpen(existing.fiscalYearId);
  if (existing.isClosed) throw conflict(`Reporting period "${existing.name}" is already closed`);

  const period = await prisma.reportingPeriod.update({ where: { id: existing.id }, data: { isClosed: true }, include: PERIOD_INCLUDE });
  await audit(actor, 'PERIOD_CLOSED', period, { oldValues: { isClosed: false }, newValues: { isClosed: true }, reason: optionalString(reason, 'reason') ?? undefined });
  return formatPeriod(period);
};

export const reopenPeriod = async (id, { reason } = {}, actor) => {
  assertCanManage(actor);
  const existing = await getPeriodOrThrow(id);
  await assertFiscalYearOpen(existing.fiscalYearId);
  if (!existing.isClosed) throw conflict(`Reporting period "${existing.name}" is not closed`);
  const cleanReason = requireString(reason, 'reason');

  const period = await prisma.reportingPeriod.update({ where: { id: existing.id }, data: { isClosed: false }, include: PERIOD_INCLUDE });
  await audit(actor, 'PERIOD_REOPENED', period, { oldValues: { isClosed: true }, newValues: { isClosed: false }, reason: cleanReason });
  return formatPeriod(period);
};

/**
 * Remove a period made by mistake. Refused once anything depends on it.
 */
export const deletePeriod = async (id, actor) => {
  assertCanManage(actor);
  const existing = await getPeriodOrThrow(id);
  await assertFiscalYearOpen(existing.fiscalYearId);
  if ((await usageOf(existing.id)) > 0) throw conflict('Reports or results depend on this period, so it cannot be deleted');

  await prisma.reportingPeriod.delete({ where: { id: existing.id } });
  const { fiscalYear: _year, frequency: _frequency, ...before } = existing;
  await audit(actor, 'PERIOD_DELETED', existing, { oldValues: before });
};

export default { assertPeriodOpen, listPeriods, getPeriodById, createPeriod, generatePeriods, updatePeriod, closePeriod, reopenPeriod, deletePeriod };
