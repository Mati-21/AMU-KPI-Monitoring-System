import { apiErrorMessage } from '../../../shared/lib/apiError';
import PerformanceSheet from '../components/PerformanceSheet';
import YearOfficePicker from '../components/YearOfficePicker';
import { usePerformanceSheet } from '../hooks/useReports';
import { useYearOffice } from '../hooks/useYearOffice';

const Message = ({ children }) => <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">{children}</p>;

/**
 * Where an office enters its results each reporting period, one table per reporting frequency.
 */
const PerformancePage = () => {
  const { years, year, offices, office, choose, isLoading } = useYearOffice();
  const { data: sheet, isLoading: sheetLoading, error } = usePerformanceSheet(year?.id, office?.id);

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Performance</h1>
            <p className="text-sm text-muted-foreground">{office ? `${office.name}: enter results for each reporting period.` : 'Enter results for each reporting period.'}</p>
          </div>
          <YearOfficePicker years={years} year={year} offices={offices} office={office} onChange={choose} />
        </div>

        {!isLoading && !year && <Message>There are no fiscal years yet.</Message>}
        {!isLoading && year && offices.length === 0 && <Message>No signed contract to report on in {year.name} yet. Results are entered once the contract is signed.</Message>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load the performance.')}</p>}
        {sheetLoading && office && <p className="text-sm text-foreground">Loading...</p>}

        {sheet?.contract && <PerformanceSheet sheet={sheet} />}
      </main>
    </div>
  );
};

export default PerformancePage;
