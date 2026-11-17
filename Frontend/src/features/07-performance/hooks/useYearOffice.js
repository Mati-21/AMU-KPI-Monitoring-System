import { useSearchParams } from 'react-router-dom';

import { useLiveFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import { defaultYear } from '../../06-reporting-periods/lib/fiscalYear';
import { usePerformanceOffices } from './useReports';

/**
 * The year and office a performance page shows, kept in the address so a link opens the same view.
 * By default the active year and the person's own office.
 */
export const useYearOffice = () => {
  const [params, setParams] = useSearchParams();
  const { data: years = [], isLoading: yearsLoading } = useLiveFiscalYears();
  const year = defaultYear(years, params.get('year'));
  const { data: offices = [], isLoading: officesLoading } = usePerformanceOffices(year?.id);
  const office = offices.find((item) => item.id === params.get('office')) ?? offices[0];

  const choose = ({ year: nextYear, office: nextOffice }) => {
    const next = { year: nextYear ?? year?.id, office: nextYear ? undefined : nextOffice ?? office?.id };
    setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)));
  };

  return { years, year, offices, office, choose, isLoading: yearsLoading || officesLoading };
};

export default useYearOffice;
