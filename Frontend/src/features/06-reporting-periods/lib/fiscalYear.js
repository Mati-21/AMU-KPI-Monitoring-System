import { currentEthiopianYear, fromEthiopian, toEthiopian } from '../../../shared/lib/ethiopianDate';

const HAMLE = 11;
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
