import { currentEthiopianYear, fromEthiopian, toEthiopian } from '../../../shared/lib/ethiopianDate';

const HAMLE = 11;

/**
 * The year a page opens on: the one asked for, else the active year even when a year is still being planned, else the
 * latest year that has started, since a planning year has no results yet. Only a list of planning years falls back
 * to the first of them.
 */
export const defaultYear = (years = [], chosenId = null) =>
  years.find((year) => year.id === chosenId) ??
  years.find((year) => year.status === 'ACTIVE') ??
  [...years].filter((year) => year.status !== 'PLANNING').sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0] ??
  years[0];

const SENE = 10;

/**
 * The fiscal year after the latest one, or the current one when there is none. An Ethiopian fiscal year runs from
 * Hamle 1 to Sene 30, and takes the number of the year it ends in.
 */
export const nextFiscalYear = (years = []) => {
  const latestEnd = years.map((year) => year.endDate).sort().at(-1);
  const today = toEthiopian(new Date(), { local: true });
  const endsIn = latestEnd ? toEthiopian(latestEnd).year + 1 : today.month >= HAMLE ? currentEthiopianYear() + 1 : currentEthiopianYear();
  return { name: `${endsIn} E.C.`, startDate: fromEthiopian(endsIn - 1, HAMLE, 1), endDate: fromEthiopian(endsIn, SENE, 30) };
};
