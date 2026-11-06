import { formatDateTime } from '../../../../10-system/lib/auditFormat';
import { useMonitoringHost, useMonitoringOverview } from '../../../hooks/useMonitoring';
import { BLUE, PURPLE, clockTime, formatBytes, formatDuration, formatPercent, levelColor } from '../../../lib/monitoringFormat';
import { DataState, Meter, Notice, Panel, Stat, Table, TrendChart } from './parts';

const CoreBars = ({ cores, warning }) => (
  <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-12 lg:grid-cols-6 xl:grid-cols-12" aria-label="Load on each core">
    {cores.map((percent, index) => (
      <div key={index} className="flex h-10 items-end rounded bg-muted" title={`Core ${index + 1}: ${percent}%`}>
        <div className="w-full rounded" style={{ height: `${Math.max(4, percent)}%`, backgroundColor: levelColor(percent, warning) }} />
      </div>
    ))}
  </div>
);

/**
 * The machine: processor, memory, disks, network and how long it has been up.
 */
const HostSection = ({ enabled, live }) => {
  const { data, isLoading, error } = useMonitoringHost({ enabled, live });
  const { data: overview } = useMonitoringOverview();

  return (
    <DataState data={data} isLoading={isLoading} error={error}>
      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Processor" description={`${data.cpu.coreCount} cores`}>
            <Stat label="In use" value={formatPercent(data.cpu.percent)} color={levelColor(data.cpu.percent, data.thresholds.cpuWarningPercent)} hint={data.cpu.loadAverage ? `Load average ${data.cpu.loadAverage.join(' · ')}` : undefined} />
            <div className="mt-3">
              <Meter value={data.cpu.percent} color={levelColor(data.cpu.percent, data.thresholds.cpuWarningPercent)} label="Processor in use" />
            </div>
            <CoreBars cores={data.cpu.perCore} warning={data.thresholds.cpuWarningPercent} />
          </Panel>

          <Panel title="Memory" description={`${formatBytes(data.memory.usedBytes)} of ${formatBytes(data.memory.totalBytes)}`}>
            <Stat label="In use" value={formatPercent(data.memory.percent)} color={levelColor(data.memory.percent, data.thresholds.memoryWarningPercent)} />
            <div className="mt-3">
              <Meter value={data.memory.percent} color={levelColor(data.memory.percent, data.thresholds.memoryWarningPercent)} label="Memory in use" />
            </div>
            {data.swap && data.swap.totalBytes > 0 && (
              <div className="mt-5">
                <Stat label="Swap" value={formatPercent(data.swap.percent)} hint={`${formatBytes(data.swap.usedBytes)} of ${formatBytes(data.swap.totalBytes)}. Heavy use means memory is short.`} />
                <div className="mt-2">
                  <Meter value={data.swap.percent} color={levelColor(data.swap.percent, 25, 60)} label="Swap in use" />
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Disk space" description="Where the system keeps its files">
            <div className="space-y-5">
              {data.disks.length === 0 && <Notice>No disk could be read.</Notice>}
              {data.disks.map((disk) => (
                <div key={disk.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{disk.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(disk.freeBytes)} free of {formatBytes(disk.totalBytes)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Meter value={disk.percent} color={levelColor(disk.percent, data.thresholds.diskWarningPercent, data.thresholds.diskCriticalPercent)} label={`${disk.label} full`} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatPercent(disk.percent)} full</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Load over the last 10 minutes" description="Processor and memory, a reading every 10 seconds" className="lg:col-span-2">
            <TrendChart
              data={data.recent.map((point) => ({ label: clockTime(point.at), cpu: point.cpuPercent, memory: point.memoryPercent }))}
              series={[
                { key: 'cpu', label: 'Processor', color: BLUE },
                { key: 'memory', label: 'Memory', color: PURPLE },
              ]}
              max={100}
              format={(value) => `${value}%`}
              kind="area"
            />
          </Panel>

          <Panel title="Server" description={`${data.system.hostname} · ${data.system.platform} ${data.system.architecture}`}>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Machine up for" value={formatDuration(data.system.uptimeSeconds)} hint={`since ${formatDateTime(data.system.bootedAt)}`} />
              {overview && <Stat label="Server up for" value={formatDuration(overview.release.uptimeSeconds)} hint={`${overview.release.restarts.length} recorded start${overview.release.restarts.length === 1 ? '' : 's'}`} />}
            </div>
            <ul className="mt-4 space-y-1">
              {data.network.interfaces.map((networkInterface) => (
                <li key={`${networkInterface.name}-${networkInterface.address}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{networkInterface.name}</span>
                  <span className="text-foreground">{networkInterface.address}</span>
                </li>
              ))}
            </ul>
            {data.network.throughput && (
              <p className="mt-3 text-xs text-muted-foreground">
                In {formatBytes(data.network.throughput.receiveBytesPerSecond)}/s · Out {formatBytes(data.network.throughput.sendBytesPerSecond)}/s · {data.network.throughput.droppedPackets} dropped
              </p>
            )}
          </Panel>

          {overview && (
            <Panel title="Server restarts" description="Every time the server started, newest first" className="lg:col-span-3">
              <Table
                rows={overview.release.restarts}
                rowKey={(row) => row.id}
                empty="No starts recorded yet."
                columns={[
                  { header: 'Started', render: (row) => formatDateTime(row.startedAt) },
                  { header: 'Version', render: (row) => `v${row.version}` },
                  { header: 'Commit', render: (row) => row.commit ?? '-' },
                  { header: 'Node', render: (row) => row.nodeVersion },
                ]}
              />
            </Panel>
          )}
        </div>
      )}
    </DataState>
  );
};

export default HostSection;
