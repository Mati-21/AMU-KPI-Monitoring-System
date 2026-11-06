import { prisma } from '../../../config/database.js';
import { badRequest } from '../../../utils/httpError.js';

/**
 * One row a minute in the database, so the trend charts survive a restart. Shorter ranges show every minute; longer
 * ones are grouped (five minutes for a day, an hour for a week) so a chart never has more than a few hundred points.
 */

const MINUTE_MS = 60 * 1000;
const RANGES = {
  hour: { spanMs: 60 * MINUTE_MS, groupMs: MINUTE_MS },
  day: { spanMs: 24 * 60 * MINUTE_MS, groupMs: 5 * MINUTE_MS },
  week: { spanMs: 7 * 24 * 60 * MINUTE_MS, groupMs: 60 * MINUTE_MS },
};

const average = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
const round = (value, digits = 1) => Number(value.toFixed(digits));

export const saveRollups = async (rollups) => {
  for (const rollup of rollups) {
    const { bucketStart, ...values } = rollup;
    await prisma.metricRollup.upsert({ where: { bucketStart }, create: { bucketStart, ...values }, update: values });
  }
};

export const pruneRollups = (retentionDays) => prisma.metricRollup.deleteMany({ where: { bucketStart: { lt: new Date(Date.now() - retentionDays * 24 * 60 * MINUTE_MS) } } });

export const getHistory = async (range = 'hour') => {
  const definition = RANGES[range];
  if (!definition) throw badRequest(`range must be one of: ${Object.keys(RANGES).join(', ')}`);

  const rows = await prisma.metricRollup.findMany({ where: { bucketStart: { gte: new Date(Date.now() - definition.spanMs) } }, orderBy: { bucketStart: 'asc' } });
  const groups = new Map();
  for (const row of rows) {
    const key = Math.floor(row.bucketStart.getTime() / definition.groupMs) * definition.groupMs;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return {
    range,
    groupMinutes: definition.groupMs / MINUTE_MS,
    points: [...groups.entries()].map(([start, group]) => ({
      start: new Date(start).toISOString(),
      requests: group.reduce((sum, row) => sum + row.requests, 0),
      status4xx: group.reduce((sum, row) => sum + row.status4xx, 0),
      status5xx: group.reduce((sum, row) => sum + row.status5xx, 0),
      // The worst minute in the group, so a slow spell is not averaged away
      p95Ms: round(Math.max(...group.map((row) => row.p95Ms))),
      cpuPercent: round(average(group, 'cpuPercent')),
      memoryPercent: round(average(group, 'memoryPercent')),
      eventLoopLagMs: round(average(group, 'eventLoopLagMs')),
      dbConnections: Math.round(average(group, 'dbConnections')),
    })),
  };
};

export default { saveRollups, pruneRollups, getHistory };
