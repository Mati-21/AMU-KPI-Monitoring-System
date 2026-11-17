import { Link } from 'react-router-dom';

import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useReports } from '../../07-performance/hooks/useReports';
import BandLabel from '../components/BandLabel';
import CompareBars from '../components/CompareBars';
import FeedbackList from '../components/FeedbackList';
import KpiBars from '../components/KpiBars';
import OfficeBars from '../components/OfficeBars';
import Panel from '../components/Panel';
import OfficeCards from '../components/OfficeCards';
import TodoPanel from '../components/TodoPanel';
import { useOfficeDashboard, useOfficesBelowDashboard } from '../hooks/useDashboards';
import { bandFor, fullName, percentText, todoFromDeadlines } from '../lib/dashboardRules';

const WAITING = ['SUBMITTED', 'UNDER_REVIEW'];

/**
 * The head's own contract, in short, beside the office's figures.
 */
const OwnContractCard = ({ mine, onOpen }) => {
  const percent = mine.score?.officialScore ?? null;
  return (
    <Panel title="My own contract" description={`Your own part of the work in ${mine.office.name}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-foreground">{percentText(percent)}</p>
          {percent === null ? <p className="text-xs text-muted-foreground">No approved results yet</p> : <BandLabel band={bandFor(percent, mine.bands)} />}
        </div>
        <button type="button" onClick={onOpen} className="text-xs font-medium text-primary hover:underline">
          Open my dashboard
        </button>
      </div>
    </Panel>
  );
};

/**
 * One office: its score and KPIs, what needs doing, its staff and the offices directly below it compared.
 */
const OfficeView = ({ officeId, year, periodId, mine, onSelectOffice, onOpenMine }) => {
  const can = useCan();
  const { data: dashboard, isLoading, error } = useOfficeDashboard(officeId, year.id, periodId);
  const { data: below } = useOfficesBelowDashboard(officeId, year.id, periodId, can('dashboard:read_all'));
  const reviews = can('report:review');
  const { data: reports = [] } = useReports({ fiscalYearId: reviews ? year.id : undefined });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the dashboard...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{apiErrorMessage(error, 'Could not load this dashboard.')}</p>;

  const waiting = reports.filter((report) => report.side === 'BELOW' && WAITING.includes(report.status)).length;
  const performance = `/performance?year=${year.id}&office=${officeId}`;
  const overdueBelow = (below?.reports.pending ?? []).filter((item) => item.isOverdue).length;
  const todo = [
    ...(waiting > 0 ? [{ tone: 'warning', text: `${waiting} report${waiting === 1 ? '' : 's'} wait${waiting === 1 ? 's' : ''} for your approval`, to: `/approvals?year=${year.id}` }] : []),
    ...todoFromDeadlines(dashboard.deadlines).map((item) => ({ ...item, to: performance })),
    ...(overdueBelow > 0 ? [{ tone: 'neutral', text: `${overdueBelow} report${overdueBelow === 1 ? '' : 's'} from the offices below ${overdueBelow === 1 ? 'is' : 'are'} overdue` }] : []),
  ];

  const staffRows = (dashboard.staff ?? []).map((row) => ({
    key: row.contractId,
    name: fullName(row.person),
    detail: row.person.id === mine?.person?.id ? 'You' : null,
    score: row.score,
    latestState: row.latestReport?.state,
  }));
  const belowRows = (below?.subordinates ?? []).map((row) => ({ key: row.office.id, id: row.office.id, name: row.office.name, detail: row.office.officeType?.name, score: row.score, latestState: row.latestReport?.state }));
  // The chart compares the offices directly below plus the office's own KPIs; an office with none below shows its staff
  const ownRow = mine?.contractId && mine.office?.id === officeId ? { key: 'own', isOwn: true, name: `${dashboard.office.name}, own KPIs`, detail: 'Kept by this office', score: mine.score, summary: mine.summary, latestState: null } : null;
  const staffBars = (dashboard.staff ?? []).map((row) => ({ key: row.contractId, name: fullName(row.person), detail: row.person.id === mine?.person?.id ? 'You' : null, score: row.score, summary: row.summary, latestState: row.latestReport?.state }));
  const chartRows = belowRows.length > 0 ? [...(ownRow ? [ownRow] : []), ...belowRows] : staffBars;
  const hasSide = (mine && mine.contractId && mine.office?.id === officeId) || (staffRows.length > 0 && belowRows.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{dashboard.office.name}</h2>
        <p className="text-sm text-muted-foreground">
          {dashboard.office.officeType?.name ?? 'Office'} · {dashboard.contractStatus ? `contract ${dashboard.contractStatus.toLowerCase()}` : `no signed contract for ${year.name}`}
        </p>
      </div>

      <OfficeCards score={dashboard.score} summary={dashboard.summary} bands={dashboard.bands} kpis={dashboard.kpis} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OfficeBars
            rows={chartRows}
            title={belowRows.length > 0 ? 'Performance by office' : 'Performance by staff'}
            description={belowRows.length > 0 ? "This office's own KPIs and the offices directly below it. Scores are compared, never averaged. Open an office to see its dashboard." : "Each person's own contract. Their approved results also add up into the office's figures."}
            emptyText="No offices or staff contracts to compare yet."
            onSelect={(row) => (row.isOwn ? onOpenMine() : belowRows.length > 0 ? onSelectOffice(row.id) : undefined)}
          />
        </div>
        <TodoPanel items={todo} />
      </div>

      <div className={`grid gap-5 ${hasSide ? 'lg:grid-cols-3' : ''}`}>
        <div className={hasSide ? 'lg:col-span-2' : ''}>
          <KpiBars kpis={dashboard.kpis} />
        </div>
        {hasSide && (
          <div className="space-y-5">
            {mine?.contractId && mine.office?.id === officeId && <OwnContractCard mine={mine} onOpen={onOpenMine} />}
            {staffRows.length > 0 && belowRows.length > 0 && (
              <CompareBars compact title="My staff" description="Each person's own contract, best score first. Their approved results also add up into the office's figures." rows={staffRows} bands={dashboard.bands} emptyText="No staff contracts this year." />
            )}
          </div>
        )}
      </div>

      <FeedbackList feedback={dashboard.feedback} title="Feedback from the office above" />
      <p className="text-xs text-muted-foreground">
        Only approved results count. To enter or check results, open{' '}
        <Link to={performance} className="font-medium text-primary hover:underline">
          Performance
        </Link>
        .
      </p>
    </div>
  );
};

export default OfficeView;
