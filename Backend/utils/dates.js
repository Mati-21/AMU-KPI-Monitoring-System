/**
 * Date helpers for @db.Date columns (stored as UTC calendar dates).
 */

// The calendar day starts and ends in the university's time zone (setting general.timezone), not in UTC
let timeZone = 'Africa/Addis_Ababa';

export const setTimeZone = (zone) => {
  if (zone) timeZone = zone;
};

export const startOfTodayUtc = () => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(`${day}T00:00:00Z`);
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

/**
 * The same test as activeOn, for a record already in memory.
 */
export const isActiveToday = (from, to) => {
  const today = startOfTodayUtc();
  return from <= today && (!to || to >= today);
};

export default { startOfTodayUtc, activeOn, overlaps, isActiveToday };
