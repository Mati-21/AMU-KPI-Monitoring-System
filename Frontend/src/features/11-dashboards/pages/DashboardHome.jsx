import { useSearchParams } from 'react-router-dom';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useFiscalYears, usePeriods } from '../../06-reporting-periods/hooks/usePlanning';
import { usePerformanceOffices } from '../../07-performance/hooks/useReports';
import { optionLabel } from '../../10-system/lib/settingValues';
import { useMyDashboard, useUniversityDashboard } from '../hooks/useDashboards';
import OfficeView from '../views/OfficeView';
import PersonalView from '../views/PersonalView';
import SystemView from '../views/SystemView';
import UniversityView from '../views/UniversityView';

const Message = ({ children }) => <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">{children}</p>;

/**
 * The year a dashboard opens on: the active one, or else the latest that has started, since a year still being planned
 * has no results yet.
 */
const pickYear = (years, chosenId) => years.find((item) => item.id === chosenId) ?? years.find((item) => item.status === 'ACTIVE') ?? years.find((item) => item.status !== 'PLANNING') ?? years[0];

/**
 * The dashboard fits who is signed in: the system overview for the Super Admin, with the whole university one choice
 * away; an office for its head (with the
 * offices below and their staff), and their own contract for everyone else. The choices stay in the address, so a
 * link opens the same view.
 */
const DashboardHome = () => {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const { data: years = [], isLoading: yearsLoading } = useFiscalYears();
  const year = pickYear(years, params.get('year'));
  const periodId = params.get('period') || '';
  const { data: periods = [] } = usePeriods(year?.id);

  const readsOffices = can('dashboard:read');
  const { data: offices = [], isLoading: officesLoading } = usePerformanceOffices(readsOffices ? year?.id : undefined);
  const mine = useMyDashboard(year?.id, periodId);
  // The whole university is for the Super Admin and for those reading all from the top office
  const atTop = offices.some((office) => office.isOwn && !office.parentOfficeId);
  const university = useUniversityDashboard(year?.id, periodId, can('*') || (atTop && can('dashboard:read_all')));

  const isSuperAdmin = can('*');
  const options = [
    ...(isSuperAdmin ? [{ value: 'system', label: 'System overview' }] : []),
    ...(university.isSuccess ? [{ value: 'university', label: 'Whole university' }] : []),
    ...offices.map((office) => ({ value: `office:${office.id}`, label: office.isOwn ? `${office.name} (yours)` : office.name })),
    ...(mine.data?.contractId ? [{ value: 'me', label: 'My own contract' }] : []),
  ];
  const ownOffice = offices.find((office) => office.isOwn) ?? offices[0];
  const fallback = isSuperAdmin ? 'system' : ownOffice ? `office:${ownOffice.id}` : 'me';
  const view = params.get('view') || fallback;
  // The system overview is not about a year, so it needs no year or period
  const isSystem = view === 'system';

  const choose = (next) => {
    const merged = { year: year?.id, period: periodId, view, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([, value]) => value)));
  };

  const loading = yearsLoading || (readsOffices && officesLoading) || mine.isLoading;
  // The select reads an empty value as nothing chosen, so the whole year has a value of its own
  const periodOptions = [{ value: 'all', label: 'Whole year' }, ...[...periods].sort((a, b) => new Date(a.endDate) - new Date(b.endDate)).map((period) => ({ value: period.id, label: period.name }))];

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{isSystem ? 'How the system is used, and what it holds.' : 'Approved results only. A result still waiting, or sent back, is shown as that, never as zero.'}</p>
          </div>
          {year && (
            <div className="flex flex-wrap gap-2">
              {options.length > 1 && (
                <div className="w-64">
                  <CustomSelect compact options={options} value={view} onChange={(next) => choose({ view: next })} />
                </div>
              )}
              {!isSystem && (
                <>
                  <div className="w-40">
                    <CustomSelect compact options={periodOptions} value={periodId || 'all'} onChange={(next) => choose({ period: next === 'all' ? '' : next })} />
                  </div>
                  <div className="w-48">
                    <CustomSelect compact options={years.map((item) => ({ value: item.id, label: `${item.name} (${optionLabel(item.status)})` }))} value={year.id} onChange={(next) => choose({ year: next, period: '' })} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {!yearsLoading && !year && <Message>There are no fiscal years yet.</Message>}
        {year && loading && <p className="text-sm text-muted-foreground">Loading the dashboard...</p>}
        {isSystem && <SystemView onOpenUniversity={() => choose({ view: 'university' })} />}
        {year && !loading && view === 'university' && university.data && <UniversityView dashboard={university.data} onSelectOffice={(id) => choose({ view: `office:${id}` })} />}
        {year && !loading && view.startsWith('office:') && (
          <OfficeView key={view} officeId={view.slice('office:'.length)} year={year} periodId={periodId} mine={mine.data} onSelectOffice={(id) => choose({ view: `office:${id}` })} onOpenMine={() => choose({ view: 'me' })} />
        )}
        {year && !loading && view === 'me' && (mine.error ? <p className="text-sm text-red-600 dark:text-red-400">{apiErrorMessage(mine.error, 'Could not load your dashboard.')}</p> : mine.data && <PersonalView dashboard={mine.data} year={year} />)}
      </main>
    </div>
  );
};

export default DashboardHome;
