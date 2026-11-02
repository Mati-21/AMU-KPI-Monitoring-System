/**
 * The Ethiopian calendar for the server: reporting periods follow Ethiopian months. Dates stay Gregorian UTC
 * calendar dates, as stored in @db.Date columns. Conversion goes through the Julian day number.
 */

// Julian day number of Meskerem 1, year 1
const EPOCH = 1724221;
const DAY_MS = 24 * 60 * 60 * 1000;
// Julian day number of 1 January 1970, where a Date's time starts
const UNIX_EPOCH_JDN = 2440588;

const toJdn = (date) => Math.floor(date.getTime() / DAY_MS) + UNIX_EPOCH_JDN;
const fromJdn = (jdn) => new Date((jdn - UNIX_EPOCH_JDN) * DAY_MS);

const ethiopianToJdn = (year, month, day) => EPOCH + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;

export const toEthiopian = (date) => {
  const jdn = toJdn(date);
  // Four-year cycles, where the third year is the one with Pagume 6
  const cycle = Math.floor((jdn - EPOCH) / 1461);
  const r = jdn - EPOCH - cycle * 1461;
  const yearInCycle = r < 365 ? 0 : r < 730 ? 1 : r < 1096 ? 2 : 3;
  const n = r - [0, 365, 730, 1096][yearInCycle];
  return { year: 4 * cycle + yearInCycle + 1, month: Math.floor(n / 30) + 1, day: (n % 30) + 1 };
};

export const fromEthiopian = (year, month, day) => fromJdn(ethiopianToJdn(year, month, day));

/**
 * Move by whole Ethiopian months, keeping the day. Pagume counts as the end of Nehase, so a quarter starting on
 * Hamle 1 runs to Meskerem 30 with Pagume inside it.
 */
export const addEthiopianMonths = (date, months) => {
  const { year, month, day } = toEthiopian(date);
  const ordinal = year * 12 + Math.min(month, 12) - 1 + months;
  return fromEthiopian(Math.floor(ordinal / 12), (ordinal % 12) + 1, month === 13 ? 30 : day);
};

export default { toEthiopian, fromEthiopian, addEthiopianMonths };
