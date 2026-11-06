import { Activity, BarChart3, Palette, Shield, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { apiErrorMessage } from '../../../shared/lib/apiError';
import { actionLabel, entityLabel, formatDateTime } from '../../10-system/lib/auditFormat';
import AlertsBanner from '../components/system/monitoring/AlertsBanner';
import DatabaseSection from '../components/system/monitoring/DatabaseSection';
import HostSection from '../components/system/monitoring/HostSection';
import { LazySection } from '../components/system/monitoring/parts';
import SectionNav from '../components/system/monitoring/SectionNav';
import SecuritySection from '../components/system/monitoring/SecuritySection';
import StatusStrip from '../components/system/monitoring/StatusStrip';
import TrafficSection from '../components/system/monitoring/TrafficSection';
import StatCard from '../components/system/StatCard';
import UsageCharts from '../components/system/UsageCharts';
import { useLivePresence, useSystemDashboard } from '../hooks/useDashboards';
import { fullName } from '../lib/dashboardRules';

// The parts of this long page, in order, for the links at the top
const SECTIONS = [
  { id: 'usage', label: 'Usage' },
  { id: 'host', label: 'Server' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'database', label: 'Database' },
  { id: 'security', label: 'Security' },
  { id: 'activity', label: 'Activity' },
];

/**
 * The Super Admin's view of the system itself: is it healthy, what it holds, how it is used, how the server, traffic
 * and database are doing, and what happened last. Performance is one choice away, under Whole university.
 */
const SystemView = ({ onOpenUniversity }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useSystemDashboard();
  useLivePresence();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the dashboard...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{apiErrorMessage(error, 'Could not load the system dashboard.')}</p>;

  const { stats, status, activity } = data;
  const cards = [
    { icon: Users, label: 'Total Users', value: stats.users, addLabel: 'Add a user', to: '/user-management?tab=add' },
    { icon: BarChart3, label: 'Total KPIs', value: stats.kpis, addLabel: 'Register a KPI', to: '/kpi?tab=register' },
    { icon: Palette, label: 'Total Themes', value: stats.themes, addLabel: 'Add a theme', to: '/kpi?tab=themes' },
    { icon: Shield, label: 'Total Roles', value: stats.roles, addLabel: 'Add a role', to: '/role-management?tab=addRole' },
    { icon: Activity, label: 'Active KPIs', value: stats.activeKpis },
  ];

  return (
    <div className="space-y-6">
      <StatusStrip />
      <AlertsBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} onAdd={card.to ? () => navigate(card.to) : undefined} />
        ))}
      </div>

      <SectionNav sections={SECTIONS} />

      <section id="usage" aria-label="Usage" className="scroll-mt-16 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Usage</h2>
        <UsageCharts status={status} />
      </section>

      <LazySection id="host" title="Server">
        {(view) => <HostSection {...view} />}
      </LazySection>
      <LazySection id="traffic" title="Traffic">
        {(view) => <TrafficSection {...view} />}
      </LazySection>
      <LazySection id="database" title="Database">
        {(view) => <DatabaseSection {...view} />}
      </LazySection>
      <LazySection id="security" title="Security">
        {(view) => <SecuritySection {...view} />}
      </LazySection>

      <div id="activity" className="scroll-mt-16 grid gap-6 lg:grid-cols-3">
        <section aria-label="Recent activity" className="rounded-xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
              <p className="mt-1 text-xs text-muted-foreground">The latest actions in the system log</p>
            </div>
            <Link to="/system-logs" className="text-xs font-medium text-blue-500 hover:underline">
              View all logs
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{actionLabel(item.action)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[fullName(item.actor) || 'System', entityLabel(item.entityType)].join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="py-2.5 text-sm text-muted-foreground">Nothing recorded yet.</li>}
          </ul>
        </section>

        <section aria-label="Performance" className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-foreground">University Performance</h3>
            <p className="mt-1 text-xs text-muted-foreground">Scores, KPIs and every office compared, from approved results.</p>
          </div>
          <button type="button" onClick={onOpenUniversity} className="mt-5 self-start rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Open performance dashboard
          </button>
        </section>
      </div>
    </div>
  );
};

export default SystemView;
