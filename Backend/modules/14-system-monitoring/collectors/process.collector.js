import { monitorEventLoopDelay, PerformanceObserver } from 'perf_hooks';

/**
 * The Node process itself: memory, how long it takes to react (event-loop delay: a high figure means the process
 * is overloaded or something is blocking it), and garbage-collection pauses. Each reading covers the time since the
 * previous one.
 */

const NS_PER_MS = 1e6;
const round = (value, digits = 1) => Number(value.toFixed(digits));

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

let gc = { count: 0, totalMs: 0, maxMs: 0 };
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    gc.count += 1;
    gc.totalMs += entry.duration;
    gc.maxMs = Math.max(gc.maxMs, entry.duration);
  }
}).observe({ entryTypes: ['gc'] });

export const sampleProcess = () => {
  const memory = process.memoryUsage();
  const eventLoop = {
    meanMs: round(loopDelay.mean / NS_PER_MS),
    p99Ms: round(loopDelay.percentile(99) / NS_PER_MS),
    maxMs: round(loopDelay.max / NS_PER_MS),
  };
  loopDelay.reset();
  const collected = { count: gc.count, totalPauseMs: round(gc.totalMs), maxPauseMs: round(gc.maxMs) };
  gc = { count: 0, totalMs: 0, maxMs: 0 };

  return {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, externalBytes: memory.external },
    eventLoop,
    gc: collected,
    // Open sockets, timers and files. A number that only ever climbs points to a leak.
    activeHandles: process.getActiveResourcesInfo().length,
  };
};

export default { sampleProcess };
