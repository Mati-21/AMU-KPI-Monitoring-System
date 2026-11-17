import { useSearchParams } from 'react-router-dom';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/components/ui/Tabs';
import { useLiveFiscalYears } from '../../06-reporting-periods/hooks/usePlanning';
import { defaultYear } from '../../06-reporting-periods/lib/fiscalYear';
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
  const { data: years = [], isLoading: yearsLoading } = useLiveFiscalYears();
  const year = defaultYear(years, params.get('year'));
  // The tab is kept in the address, so coming back from a report lands on the same list
  const tab = params.get('tab') === 'reviewed' ? 'reviewed' : 'pending';
  const { data = [], isLoading, error } = useReports({ fiscalYearId: year?.id });
  // The top office has nobody above it: its own report is approved by someone who reviews within it, so it is listed here too
  const fromBelow = data.filter((report) => report.side === 'BELOW' || report.canReview);
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
              <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => setParams({ year: next, tab })} />
            </div>
          )}
        </div>

        {!yearsLoading && !year && <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">There are no fiscal years yet.</p>}
        {year && (
          <Tabs value={tab} onValueChange={(next) => setParams({ year: year.id, tab: next })}>
            <TabsList>
              <TabsTrigger value="pending">Pending Review ({waiting.length})</TabsTrigger>
              <TabsTrigger value="reviewed">Already Reviewed ({reviewed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <ApprovalList title="Pending Review" description="Results waiting for you. Check their evidence, then approve them or send them back." reports={waiting} isLoading={isLoading} error={error} emptyText="Nothing is waiting for your approval." actionLabel="Review" />
            </TabsContent>
            <TabsContent value="reviewed">
              <ApprovalList title="Already Reviewed" description="Approved results count in the reports. Results sent back wait for the office to correct and submit them again." reports={reviewed} isLoading={isLoading} error={error} emptyText="Nothing reviewed yet this year." actionLabel="Open" />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default ApprovalsPage;
