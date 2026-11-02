/**
 * The Ethiopian calendar, which is the only calendar people see. Dates are still stored as Gregorian dates.
 * A year has 12 months of 30 days and Pagume, with 5 days, or 6 when the year before a Gregorian leap year ends.
 * Conversion goes through the Julian day number, so it holds for any date.
 */

// Julian day number of Meskerem 1, year 1
const EPOCH = 1724221;

export const MONTHS = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

const gregorianToJdn = (year, month, day) => {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
};

const jdnToGregorian = (jdn) => {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { year: 100 * b + d - 4800 + Math.floor(m / 10), month: m + 3 - 12 * Math.floor(m / 10), day: e - Math.floor((153 * m + 2) / 5) + 1 };
};

const ethiopianToJdn = (year, month, day) => EPOCH + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;

const jdnToEthiopian = (jdn) => {
  // Four-year cycles, where the third year is the one with Pagume 6
  const cycle = Math.floor((jdn - EPOCH) / 1461);
  const r = jdn - EPOCH - cycle * 1461;
  const yearInCycle = r < 365 ? 0 : r < 730 ? 1 : r < 1096 ? 2 : 3;
  const n = r - [0, 365, 730, 1096][yearInCycle];
  return { year: 4 * cycle + yearInCycle + 1, month: Math.floor(n / 30) + 1, day: (n % 30) + 1 };
};

export const daysInMonth = (year, month) => {
  if (month < 13) return 30;
  return year % 4 === 3 ? 6 : 5;
};

const pad = (number) => String(number).padStart(2, '0');

/**
 * The Ethiopian date of a Gregorian one. A 'YYYY-MM-DD' string or a stored calendar date is read as it is; with
 * local, a moment in time is read on the viewer's own clock.
 */
export const toEthiopian = (value, { local = false } = {}) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return jdnToEthiopian(gregorianToJdn(year, month, day));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return local
    ? jdnToEthiopian(gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate()))
    : jdnToEthiopian(gregorianToJdn(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
};

/**
 * The Gregorian 'YYYY-MM-DD' of an Ethiopian date, the form the server stores.
 */
export const fromEthiopian = (year, month, day) => {
  const { year: y, month: m, day: d } = jdnToGregorian(ethiopianToJdn(year, month, day));
  return `${y}-${pad(m)}-${pad(d)}`;
};

const words = ({ year, month, day }) => `${MONTHS[month - 1]} ${day}, ${year}`;

/**
 * A stored calendar date, such as a period's end: Tikimt 23, 2019.
 */
export const formatEthiopianDate = (value) => {
  const date = toEthiopian(value);
  return date ? words(date) : '';
};

/**
 * The day a moment fell on, on the viewer's own clock.
 */
export const formatEthiopianDay = (value) => {
  const date = toEthiopian(value, { local: true });
  return date ? words(date) : '';
};

/**
 * A moment with its time: Tikimt 23, 2019, 14:05.
 */
export const formatEthiopianDateTime = (value) => {
  const date = toEthiopian(value, { local: true });
  if (!date) return '';
  const moment = new Date(value);
  return `${words(date)}, ${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
};

export const currentEthiopianYear = () => toEthiopian(new Date(), { local: true }).year;
