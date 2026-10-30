import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { parseDate, parseUuid, requireString } from '../../utils/validation.js';

/**
 * Module 04 — Fiscal years. Status moves PLANNING -> ACTIVE -> CLOSED; only a Super Admin can reopen a closed year.
 * A CLOSED year is read-only: modules that write year data call assertFiscalYearOpen() first.
 */

const assertGlobal = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.KPI_MANAGE)) {
    throw forbidden('Managing fiscal years requires university-wide kpi:manage authority');
  }
};

const getFiscalYearOrThrow = async (id) => {
  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: parseUuid(id, 'id') } });
  if (!fiscalYear) throw notFound('Fiscal year not found');
  return fiscalYear;
};

const assertNoOverlap = async (start, end, exceptId) => {
  const overlapping = await prisma.fiscalYear.findFirst({
    where: { startDate: { lte: end }, endDate: { gte: start }, ...(exceptId && { id: { not: exceptId } }) },
  });
  if (overlapping) throw conflict(`These dates overlap fiscal year "${overlapping.name}"`);
};

/**
 * Guard for every write to year data (contracts, assignments, periods, reports, values, scores).
 */
export const assertFiscalYearOpen = async (fiscalYearId) => {
  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  if (!fiscalYear) throw notFound('Fiscal year not found');
  if (fiscalYear.status === 'CLOSED') throw conflict(`Fiscal year "${fiscalYear.name}" is closed and its data is read-only`);
  return fiscalYear;
};

export const listFiscalYears = async () => {
  const years = await prisma.fiscalYear.findMany({
    orderBy: { startDate: 'desc' },
    include: { _count: { select: { periods: true, contracts: true } } },
  });
  return years.map(({ _count, ...year }) => ({ ...year, periodCount: _count.periods, contractCount: _count.contracts }));
};

export const createFiscalYear = async ({ name, startDate, endDate } = {}, actor) => {
  assertGlobal(actor);
  const cleanName = requireString(name, 'name');
  const start = parseDate(startDate, 'startDate');
  const end = parseDate(endDate, 'endDate');
  if (end <= start) throw badRequest('endDate must be after startDate');
  await assertNoOverlap(start, end);

  const fiscalYear = await prisma.fiscalYear.create({ data: { name: cleanName, startDate: start, endDate: end } });
  await auditAction(actor, { action: 'FISCAL_YEAR_CREATED', entityType: 'fiscal_year', entityId: fiscalYear.id, newValues: fiscalYear });
  return fiscalYear;
};

/**
 * Name and dates can change only while the year is still being planned.
 */
export const updateFiscalYear = async (id, data = {}, actor) => {
  assertGlobal(actor);
  const existing = await getFiscalYearOrThrow(id);
  if (existing.status !== 'PLANNING') throw conflict(`Fiscal year "${existing.name}" is ${existing.status} and can no longer be edited`);

  const update = {};
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.startDate !== undefined) update.startDate = parseDate(data.startDate, 'startDate');
  if (data.endDate !== undefined) update.endDate = parseDate(data.endDate, 'endDate');
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  const start = update.startDate ?? existing.startDate;
  const end = update.endDate ?? existing.endDate;
  if (end <= start) throw badRequest('endDate must be after startDate');
  await assertNoOverlap(start, end, existing.id);

  const fiscalYear = await prisma.fiscalYear.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'FISCAL_YEAR_UPDATED', entityType: 'fiscal_year', entityId: existing.id, oldValues: existing, newValues: fiscalYear });
  return fiscalYear;
};

/**
 * Only one year can be active. The current one must be closed deliberately first, because closing locks its data.
 */
export const activateFiscalYear = async (id, actor) => {
  assertGlobal(actor);
  const existing = await getFiscalYearOrThrow(id);
  if (existing.status !== 'PLANNING') throw conflict(`Only a planning year can be activated; "${existing.name}" is ${existing.status}`);

  const active = await prisma.fiscalYear.findFirst({ where: { status: 'ACTIVE' } });
  if (active) throw conflict(`Close the active fiscal year "${active.name}" first`);

  const fiscalYear = await prisma.fiscalYear.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
  await auditAction(actor, {
    action: 'FISCAL_YEAR_ACTIVATED',
    entityType: 'fiscal_year',
    entityId: existing.id,
    oldValues: { status: existing.status },
    newValues: { status: fiscalYear.status },
  });
  return fiscalYear;
};

/**
 * Close an active year. All its data becomes read-only until a Super Admin reopens it.
 */
export const closeFiscalYear = async (id, { reason } = {}, actor) => {
  assertGlobal(actor);
  const existing = await getFiscalYearOrThrow(id);
  if (existing.status !== 'ACTIVE') throw conflict(`Only the active year can be closed; "${existing.name}" is ${existing.status}`);
  const cleanReason = requireString(reason, 'reason');

  const fiscalYear = await prisma.fiscalYear.update({ where: { id: existing.id }, data: { status: 'CLOSED' } });
  await auditAction(actor, {
    action: 'FISCAL_YEAR_CLOSED',
    entityType: 'fiscal_year',
    entityId: existing.id,
    oldValues: { status: existing.status },
    newValues: { status: fiscalYear.status },
    reason: cleanReason,
  });
  return fiscalYear;
};

/**
 * Reopen a closed year, making its data editable again. Super Admin only, and the reason is kept in the audit trail.
 * Only one year can be active, so the current active year must be closed first.
 */
export const reopenFiscalYear = async (id, { reason } = {}, actor) => {
  if (!actor.access.isSuperAdmin) throw forbidden('Only a Super Admin can reopen a closed fiscal year');
  const existing = await getFiscalYearOrThrow(id);
  if (existing.status !== 'CLOSED') throw conflict(`Only a closed year can be reopened; "${existing.name}" is ${existing.status}`);
  const cleanReason = requireString(reason, 'reason');

  const active = await prisma.fiscalYear.findFirst({ where: { status: 'ACTIVE' } });
  if (active) throw conflict(`Close the active fiscal year "${active.name}" first`);

  const fiscalYear = await prisma.fiscalYear.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
  await auditAction(actor, {
    action: 'FISCAL_YEAR_REOPENED',
    entityType: 'fiscal_year',
    entityId: existing.id,
    oldValues: { status: existing.status },
    newValues: { status: fiscalYear.status },
    reason: cleanReason,
  });
  return fiscalYear;
};

export default { assertFiscalYearOpen, listFiscalYears, createFiscalYear, updateFiscalYear, activateFiscalYear, closeFiscalYear, reopenFiscalYear };
