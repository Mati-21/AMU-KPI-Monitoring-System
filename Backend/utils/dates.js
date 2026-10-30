/**
 * Date helpers for @db.Date columns (stored as UTC calendar dates).
 */

export const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Prisma where-fragment: a record whose [fromField, toField] window contains `day`
 * (toField = null means open-ended). Returns a single object usable inside `AND: [...]`.
 */
export const activeOn = (fromField, toField, day = startOfTodayUtc()) => ({
  AND: [{ [fromField]: { lte: day } }, { OR: [{ [toField]: null }, { [toField]: { gte: day } }] }],
});

/**
 * Prisma where-fragment: a record whose [fromField, toField] window overlaps [start, end]
 * (end = null/undefined means open-ended on either side).
 */
export const overlaps = (fromField, toField, start, end) => ({
  AND: [...(end ? [{ [fromField]: { lte: end } }] : []), { OR: [{ [toField]: null }, { [toField]: { gte: start } }] }],
});

export default { startOfTodayUtc, activeOn, overlaps };
