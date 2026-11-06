import { formatDateTime } from '../../../../10-system/lib/auditFormat';
import { useMonitoringDatabase } from '../../../hooks/useMonitoring';
import { GREEN, RED, STATUS, formatBytes, formatMs, formatNumber, formatPercent, formatDuration, levelColor } from '../../../lib/monitoringFormat';
import { DataState, Meter, Notice, Panel, Stat, Table } from './parts';

/**
 * PostgreSQL: whether it answers and how fast, the connections the server holds, locks, how often reads are served
 * from memory, and the slowest queries. A replica and a separate cache are shown only when the system has them.
 */
const DatabaseSection = ({ enabled, live }) => {
  const { data, isLoading, error } = useMonitoringDatabase({ enabled, live });

  return (
    <DataState data={data} isLoading={isLoading} error={error}>
      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Connection" description={data.version ? `PostgreSQL ${data.version}` : 'PostgreSQL'}>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Status" value={data.reachable ? STATUS.healthy.label : STATUS.down.label} color={data.reachable ? GREEN : RED} />
              <Stat label="Answers in" value={formatMs(data.latencyMs)} hint="A simple question" color={data.latencyMs >= 1000 ? RED : undefined} />
              <Stat label="Database size" value={formatBytes(data.sizeBytes)} />
              <Stat label="Reads from memory" value={formatPercent(data.cacheHitPercent)} hint="Higher is better" color={data.cacheHitPercent !== null && data.cacheHitPercent < 90 ? RED : undefined} />
            </div>
          </Panel>

          <Panel title="Connection pool" description="Connections this server holds to the database">
            <Stat label="In use" value={`${data.pool.active} of ${data.pool.max}`} hint={`${data.pool.idle} idle, ${data.pool.total} open`} color={levelColor((data.pool.active / data.pool.max) * 100, 80, 95)} />
            <div className="mt-3">
              <Meter value={(data.pool.active / data.pool.max) * 100} color={levelColor((data.pool.active / data.pool.max) * 100, 80, 95)} label="Pool in use" />
            </div>
            <p className={`mt-3 text-xs ${data.pool.waiting > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {data.pool.waiting > 0 ? `${data.pool.waiting} requests are waiting for a free connection` : 'Nothing is waiting for a connection'}
            </p>
          </Panel>

          <Panel title="Activity" description="What the database is doing now">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Running queries" value={data.sessions.active} hint={`${data.sessions.idle} idle`} />
              <Stat label="Longest running" value={formatDuration(data.sessions.longestQuerySeconds)} color={data.sessions.longestQuerySeconds >= 30 ? RED : undefined} />
              <Stat label="Locks waiting" value={formatNumber(data.locksWaiting)} hint="Queries held up by another" color={data.locksWaiting > 0 ? RED : undefined} />
              <Stat label="Deadlocks" value={formatNumber(data.deadlocks)} hint="Since the database started counting" color={data.deadlocks > 0 ? RED : undefined} />
              <Stat label="Transactions" value={formatNumber(data.transactions?.committed)} hint={`${formatNumber(data.transactions?.rolledBack)} rolled back`} />
              <Stat label="Idle in transaction" value={data.sessions.idleInTransaction} hint="Open but doing nothing" color={data.sessions.idleInTransaction > 0 ? RED : undefined} />
            </div>
          </Panel>

          <Panel title="Slowest queries" description={`Statements that took over ${formatMs(data.queries.slowThresholdMs)} in the last day. Values are never recorded, only the statement.`} className="lg:col-span-2">
            <Table
              rows={data.queries.slowest}
              rowKey={(row) => row.statement}
              empty={`No query has taken longer than ${formatMs(data.queries.slowThresholdMs)}. The average query takes ${formatMs(data.queries.averageMs)}.`}
              columns={[
                { header: 'Statement', render: (row) => <span className="line-clamp-2 break-all font-mono">{row.statement}</span> },
                { header: 'Slowest', align: 'right', render: (row) => formatMs(row.maxMs) },
                { header: 'Average', align: 'right', render: (row) => formatMs(row.avgMs) },
                { header: 'Times', align: 'right', render: (row) => row.count },
                { header: 'Last', render: (row) => formatDateTime(row.lastAt) },
              ]}
            />
          </Panel>

          <Panel title="Replication and cache" description="Only shown when the system uses them">
            <div className="space-y-3">
              {data.replication.isReplica || data.replication.replicas > 0 ? (
                <Stat label="Replication" value={data.replication.replicas > 0 ? `${data.replication.replicas} replica${data.replication.replicas === 1 ? '' : 's'}` : 'This is a replica'} hint={data.replication.lagSeconds !== null ? `Behind by ${data.replication.lagSeconds} s` : undefined} />
              ) : (
                <Notice>No replica is configured: there is one database.</Notice>
              )}
              <Notice>No separate cache (such as Redis) is configured.</Notice>
            </div>
          </Panel>
        </div>
      )}
    </DataState>
  );
};

export default DatabaseSection;
