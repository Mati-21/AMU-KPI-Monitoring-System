import { useSearchParams } from 'react-router-dom';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { useFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import { optionLabel } from '../../10-system/lib/settingValues';
import ApprovalList from '../components/ApprovalList';
import { useReports } from '../hooks/useReports';

const WAITING = ['SUBMITTED', 'UNDER_REVIEW'];
const REVIEWED = ['APPROVED', 'REVISION_REQUIRED', 'REJECTED'];

/**
 * The results the offices below submitted. Approving one adds it to that office's report and to this office's own
 * period, where it counts towards what this office sends up.
 */
const ApprovalsPage = () => {
  const [params, setParams] = useSearchParams();
  const { data: years = [], isLoading: yearsLoading } = useFiscalYears();
  const year = years.find((item) => item.id === params.get('year')) ?? years.find((item) => item.status === 'ACTIVE') ?? years[0];
  const { data = [], isLoading, error } = useReports({ fiscalYearId: year?.id });
  const fromBelow = data.filter((report) => report.side === 'BELOW');
  const waiting = fromBelow.filter((report) => WAITING.includes(report.status));
  const reviewed = fromBelow.filter((report) => REVIEWED.includes(report.status));

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Approve KPI</h1>
            <p className="text-sm text-muted-foreground">Results the offices below, and your staff, submitted. Check their evidence, then approve them or send them back.</p>
          </div>
          {year && (
            <div className="w-56">
              <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => setParams({ year: next })} />
            </div>
          )}
        </div>

        {!yearsLoading && !year && <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">There are no fiscal years yet.</p>}
        {year && (
          <>
            <ApprovalList title={`Waiting for Your Approval (${waiting.length})`} reports={waiting} isLoading={isLoading} error={error} emptyText="Nothing is waiting for your approval." actionLabel="Review" />
            <ApprovalList title="Already Reviewed" description="Approved results count in the reports. Results sent back wait for the office to correct and submit them again." reports={reviewed} isLoading={isLoading} error={error} emptyText="Nothing reviewed yet this year." actionLabel="Open" />
          </>
        )}
      </main>
    </div>
  );
};

export default ApprovalsPage;
