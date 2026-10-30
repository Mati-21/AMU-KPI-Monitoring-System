import { prisma } from '../../../config/database.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { badRequest, forbidden, notFound } from '../../../utils/httpError.js';
import { optionalString, parseBoolean, parseNumber, parseUuid, requireString } from '../../../utils/validation.js';

/**
 * Module 07 — The university's performance bands (SRS 13). New calculations use the current bands.
 * Results already saved keep the band they were given.
 */

const assertCanManage = (actor) => {
  if (!actor.access.canGlobally(PERMISSIONS.SCORECARD_MANAGE)) throw forbidden('Changing performance bands requires university-wide scorecard:manage authority');
};

const parseBounds = (minPercent, maxPercent) => {
  if (maxPercent !== null && maxPercent !== undefined && maxPercent < minPercent) throw badRequest('maxPercent cannot be below minPercent');
};

export const listThresholds = () => prisma.performanceStatusThreshold.findMany({ orderBy: { sortOrder: 'asc' } });

export const createThreshold = async ({ name, minPercent, maxPercent, color, sortOrder } = {}, actor) => {
  assertCanManage(actor);
  const min = parseNumber(minPercent, 'minPercent', { required: true });
  const max = parseNumber(maxPercent, 'maxPercent') ?? null;
  parseBounds(min, max);

  const threshold = await prisma.performanceStatusThreshold.create({
    data: {
      name: requireString(name, 'name'),
      minPercent: min,
      maxPercent: max,
      color: optionalString(color, 'color') ?? null,
      sortOrder: parseNumber(sortOrder, 'sortOrder', { integer: true }) ?? 0,
    },
  });
  await auditAction(actor, { action: 'THRESHOLD_CREATED', entityType: 'performance_status_threshold', entityId: threshold.id, newValues: threshold });
  return threshold;
};

export const updateThreshold = async (id, data = {}, actor) => {
  assertCanManage(actor);
  const existing = await prisma.performanceStatusThreshold.findUnique({ where: { id: parseUuid(id, 'id') } });
  if (!existing) throw notFound('Performance band not found');

  const update = {};
  if (data.name !== undefined) update.name = requireString(data.name, 'name');
  if (data.minPercent !== undefined) update.minPercent = parseNumber(data.minPercent, 'minPercent', { required: true });
  if (data.maxPercent !== undefined) update.maxPercent = parseNumber(data.maxPercent, 'maxPercent') ?? null;
  if (data.color !== undefined) update.color = optionalString(data.color, 'color');
  if (data.sortOrder !== undefined) update.sortOrder = parseNumber(data.sortOrder, 'sortOrder', { integer: true });
  const isActive = parseBoolean(data.isActive, 'isActive');
  if (isActive !== undefined) update.isActive = isActive;
  if (Object.keys(update).length === 0) throw badRequest('No updatable fields provided');

  parseBounds(update.minPercent ?? Number(existing.minPercent), update.maxPercent === undefined ? (existing.maxPercent === null ? null : Number(existing.maxPercent)) : update.maxPercent);

  const threshold = await prisma.performanceStatusThreshold.update({ where: { id: existing.id }, data: update });
  await auditAction(actor, { action: 'THRESHOLD_UPDATED', entityType: 'performance_status_threshold', entityId: existing.id, oldValues: existing, newValues: threshold });
  return threshold;
};

export default { listThresholds, createThreshold, updateThreshold };
