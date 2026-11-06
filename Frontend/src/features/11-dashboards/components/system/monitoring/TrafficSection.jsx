import { useState } from 'react';

import { useMonitoringHistory, useMonitoringTraffic } from '../../../hooks/useMonitoring';
import { AMBER, BLUE, PURPLE, RED, SLATE, formatBytes, formatMs, formatNumber, formatPercent, levelColor } from '../../../lib/monitoringFormat';
import { DataState, Meter, Panel, RangeTabs, Stat, Table, TrendChart } from './parts';

const RANGES = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

const pointLabel = (start, range) => {
  const date = new Date(start);
  if (range === 'week') return `${date.toLocaleDateString([], { weekday: 'short' })} ${String(date.getHours()).padStart(2, '0')}h`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * How the application is doing for its users: how much traffic, how fast it answers, and how often it fails
 * (4xx: the request was wrong or not allowed; 5xx: the server failed), plus the health of the Node process.
 */
const TrafficSection = ({ enabled, live }) => {
  const [range, setRange] = useState('hour');
  const { data, isLoading, error } = useMonitoringTraffic({ enabled, live });
  const history = useMonitoringHistory(range, { enabled, live });

  // Until the first minutes are saved (right after a restart) the live minutes of the last half hour fill the charts
  const saved = history.data?.points ?? [];
  const source = saved.length >= 2 || range !== 'hour' ? saved : (data?.traffic.series ?? []);
  const points = source.map((point) => ({ label: pointLabel(point.start, range), requests: point.requests, serverErrors: point.status5xx, clientErrors: point.status4xx, slowest: point.p95Ms }));

  return (
    <DataState data={data} isLoading={isLoading} error={error}>
      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title={`Last ${data.traffic.windowMinutes} minutes`} description="What is happening now" className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Requests per second" value={data.traffic.requestsPerSecond} hint={`${formatNumber(data.traffic.requests)} requests`} />
              <Stat label="Typical response (P50)" value={formatMs(data.traffic.latencyMs.p50)} hint="Half are faster" />
              <Stat label="Slow response (P95)" value={formatMs(data.traffic.latencyMs.p95)} hint="95 in 100 are faster" color={levelColor(data.traffic.latencyMs.p95, data.thresholds.latencyP95WarningMs)} />
              <Stat label="Slowest (P99)" value={formatMs(data.traffic.latencyMs.p99)} hint="99 in 100 are faster" />
              <Stat label="Client errors (4xx)" value={formatPercent(data.traffic.clientErrorPercent)} hint="Wrong or refused requests" />
              <Stat label="Server errors (5xx)" value={formatPercent(data.traffic.serverErrorPercent)} hint="Failures on our side" color={levelColor(data.traffic.serverErrorPercent, data.thresholds.errorRateWarningPercent)} />
            </div>
          </Panel>

          <Panel title="Requests" description="Requests per minute, and how many failed" action={<RangeTabs ranges={RANGES} value={range} onChange={setRange} label="Traffic range" />} className="lg:col-span-2">
            <TrendChart
              data={points}
              series={[
                { key: 'requests', label: 'Requests', color: BLUE },
                { key: 'clientErrors', label: '4xx', color: AMBER },
                { key: 'serverErrors', label: '5xx', color: RED },
              ]}
              format={formatNumber}
              kind="area"
            />
          </Panel>

          <Panel title="Slow responses" description="The slowest 5 in 100 requests, in milliseconds">
            <TrendChart data={points} series={[{ key: 'slowest', label: 'P95', color: PURPLE }]} format={(value) => `${value}`} />
          </Panel>

          <Panel title="Slowest endpoints" description="By average time over the same window" className="lg:col-span-2">
            <Table
              rows={data.traffic.slowestRoutes}
              rowKey={(row) => row.route}
              empty="No requests yet."
              columns={[
                { header: 'Endpoint', render: (row) => <span className="break-all font-mono">{row.route}</span> },
                { header: 'Average', align: 'right', render: (row) => formatMs(row.averageMs) },
                { header: 'Slowest', align: 'right', render: (row) => formatMs(row.maxMs) },
                { header: 'Calls', align: 'right', render: (row) => formatNumber(row.count) },
                { header: 'Failed', align: 'right', render: (row) => row.errors },
              ]}
            />
          </Panel>

          <Panel title="Node process" description={`Process ${data.process.pid} · Node ${data.process.nodeVersion}`}>
            <div className="space-y-4">
              <div>
                <Stat label="Heap in use" value={formatBytes(data.process.memory.heapUsedBytes)} hint={`of ${formatBytes(data.process.memory.heapTotalBytes)} reserved`} />
                <div className="mt-2">
                  <Meter value={(data.process.memory.heapUsedBytes / data.process.memory.heapTotalBytes) * 100} color={SLATE} label="Heap in use" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Event loop lag (P99)" value={formatMs(data.process.eventLoop.p99Ms)} hint="High means overloaded" color={levelColor(data.process.eventLoop.p99Ms, data.thresholds.eventLoopLagWarningMs)} />
                <Stat label="Memory (RSS)" value={formatBytes(data.process.memory.rssBytes)} />
                <Stat label="Garbage collection" value={`${data.process.gc.count} runs`} hint={`${formatMs(data.process.gc.totalPauseMs)} paused, longest ${formatMs(data.process.gc.maxPauseMs)}`} />
                <Stat label="Open handles" value={data.process.activeHandles} hint="Sockets, timers, files" />
              </div>
            </div>
          </Panel>
        </div>
      )}
    </DataState>
  );
};

export default TrafficSection;
