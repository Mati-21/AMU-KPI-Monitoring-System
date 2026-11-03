import { useSearchParams } from 'react-router-dom';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import PerformanceSheet from '../../07-performance/components/PerformanceSheet';
import { useStaffSheet } from '../../07-performance/hooks/useReports';
import { optionLabel } from '../../10-system/lib/settingValues';
import ContractDetail from '../components/ContractDetail';
import { useContracts, useMyContracts } from '../hooks/useContracts';

const SIGNED = ['SIGNED', 'APPROVED'];
const Message = ({ children }) => <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">{children}</p>;

/**
 * One staff contract: its KPIs to sign, then once signed its results to enter each period.
 */
const StaffContract = ({ summary, contracts }) => {
  const isSigned = SIGNED.includes(summary.status);
  const { data: sheet, isLoading, error } = useStaffSheet(isSigned ? summary.id : null);

  return (
    <div className="space-y-5">
      <ContractDetail contractId={summary.id} contracts={contracts} />
      {!isSigned && <Message>Results are entered here once you sign this contract.</Message>}
      {isSigned && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-foreground">My Performance</h2>
            <p className="text-sm text-muted-foreground">Enter your results for each reporting period and submit them to {summary.office.name}. The head of the office reviews them.</p>
          </div>
          {isLoading && <p className="text-sm text-foreground">Loading...</p>}
          {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load your performance.')}</p>}
          {sheet?.contract && <PerformanceSheet sheet={sheet} />}
        </>
      )}
    </div>
  );
};

/**
 * The contract the person's office gave them, for anyone, with or without other permissions: they sign it here and
 * report their own results on it. A contract is shown once the office has assigned it.
 */
const MyContractPage = () => {
  const [params, setParams] = useSearchParams();
  const { data: years = [], isLoading: yearsLoading } = useFiscalYears();
  const year = years.find((item) => item.id === params.get('year')) ?? years.find((item) => item.status === 'ACTIVE') ?? years[0];
  const { data: mine = [], isLoading, error } = useMyContracts(year?.id);
  // The office's own contract, where a staff contract's KPIs come from, for those who may see it
  const { data: contracts = [] } = useContracts(year?.id);

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Contract</h1>
            <p className="text-sm text-muted-foreground">The KPIs your office gave you, and your results on them.</p>
          </div>
          {year && (
            <div className="w-56">
              <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => setParams({ year: next })} />
            </div>
          )}
        </div>

        {!yearsLoading && !year && <Message>There are no fiscal years yet.</Message>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load your contract.')}</p>}
        {year && !isLoading && mine.length === 0 && <Message>You have no contract for {year.name}. The head of your office gives you one under KPI Assignment.</Message>}
        {mine.map((summary) => (
          <StaffContract key={summary.id} summary={summary} contracts={contracts} />
        ))}
      </main>
    </div>
  );
};

export default MyContractPage;
