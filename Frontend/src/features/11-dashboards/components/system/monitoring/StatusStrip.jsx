import { GitCommitHorizontal, History, Rocket, Timer } from 'lucide-react';

import { formatDateTime } from '../../../../10-system/lib/auditFormat';
import { useMonitoringOverview } from '../../../hooks/useMonitoring';
import { STATUS, clockTime, formatDuration } from '../../../lib/monitoringFormat';
import { DataState } from './parts';

const HEADLINES = {
  healthy: 'All systems are healthy',
  degraded: 'Some parts are degraded',
  down: 'Part of the system is down',
};

const Fact = ({ icon, label, children }) => {
  const Icon = icon;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{children}</p>
      </div>
    </div>
  );
};

/**
 * The first thing on the page: is everything all right, which part is not, and which release is running.
 */
const StatusStrip = () => {
  const { data, isLoading, error } = useMonitoringOverview();

  return (
    <section aria-label="System health" className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <DataState data={data} isLoading={isLoading} error={error}>
        {data && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${STATUS[data.health.overall].soft}`} aria-hidden="true">
                  <span className={`h-3.5 w-3.5 rounded-full ${STATUS[data.health.overall].dot}`} />
                </span>
                <div>
                  <h2 className={`text-lg font-bold ${STATUS[data.health.overall].text}`}>{HEADLINES[data.health.overall]}</h2>
                  <p className="text-xs text-muted-foreground">
                    {data.alerts.critical + data.alerts.warnings === 0
                      ? 'No open alerts'
                      : `${data.alerts.critical} critical and ${data.alerts.warnings} warning alert${data.alerts.critical + data.alerts.warnings === 1 ? '' : 's'} open`}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="off">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live · updated {clockTime(data.takenAt)}
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {data.health.subsystems.map((subsystem) => (
                <li key={subsystem.key} className={`rounded-lg border border-border p-3 ${STATUS[subsystem.status].soft}`}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS[subsystem.status].dot}`} aria-hidden="true" />
                    {subsystem.label}
                    <span className="sr-only">: {STATUS[subsystem.status].label}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{subsystem.detail}</p>
                </li>
              ))}
            </ul>

            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={Rocket} label="Release">
                v{data.release.version} · {data.release.environment}
              </Fact>
              <Fact icon={GitCommitHorizontal} label="Commit">
                {data.release.commit ?? 'Not known'}
              </Fact>
              <Fact icon={History} label="Rolled out">
                {formatDateTime(data.release.deployedAt)}
              </Fact>
              <Fact icon={Timer} label="Server up for">
                {formatDuration(data.release.uptimeSeconds)}
              </Fact>
            </div>
          </div>
        )}
      </DataState>
    </section>
  );
};

export default StatusStrip;
