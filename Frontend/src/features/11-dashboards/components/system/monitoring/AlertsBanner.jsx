import { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

import { apiErrorMessage } from '../../../../../shared/lib/apiError';
import { useAcknowledgeAlert, useMonitoringOverview } from '../../../hooks/useMonitoring';
import { SEVERITY, timeAgo } from '../../../lib/monitoringFormat';

const SHOWN_AT_FIRST = 3;

/**
 * Problems that are open right now, worst first. Nothing is drawn when there are none. Acknowledging says someone has
 * seen it; the alert closes by itself once the problem is gone.
 */
const AlertsBanner = () => {
  const { data } = useMonitoringOverview();
  const acknowledge = useAcknowledgeAlert();
  const [showAll, setShowAll] = useState(false);

  const alerts = data?.alerts.items ?? [];
  if (alerts.length === 0) return null;
  const visible = showAll ? alerts : alerts.slice(0, SHOWN_AT_FIRST);

  return (
    <section aria-label="Open alerts" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <BellRing className="h-4 w-4 text-red-500" aria-hidden="true" />
          Open alerts ({alerts.length})
        </h2>
        <Link to="/system-logs" className="text-xs font-medium text-blue-500 hover:underline">
          View system logs
        </Link>
      </div>
      {acknowledge.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{apiErrorMessage(acknowledge.error, 'Could not acknowledge that alert.')}</p>}

      <ul className="mt-3 space-y-2">
        {visible.map((alert) => {
          const style = SEVERITY[alert.severity];
          return (
            <li key={alert.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3 ${style.soft}`}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.text}`}>
                    {alert.severity} · {style.label}
                  </span>
                  {alert.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opened {timeAgo(alert.openedAt)}
                  {alert.status === 'ACKNOWLEDGED' && alert.acknowledgedBy ? ` · seen by ${alert.acknowledgedBy.firstName} ${alert.acknowledgedBy.lastName}` : ''}
                </p>
              </div>
              {alert.status === 'OPEN' && (
                <button
                  type="button"
                  onClick={() => acknowledge.mutate(alert.id)}
                  disabled={acknowledge.isPending}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Acknowledge
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {alerts.length > SHOWN_AT_FIRST && (
        <button type="button" onClick={() => setShowAll((open) => !open)} className="mt-3 text-xs font-medium text-blue-500 hover:underline">
          {showAll ? 'Show fewer' : `Show all ${alerts.length}`}
        </button>
      )}
    </section>
  );
};

export default AlertsBanner;
