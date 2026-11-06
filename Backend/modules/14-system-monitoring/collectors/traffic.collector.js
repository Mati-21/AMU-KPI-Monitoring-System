import { RingBuffer } from '../store/ringBuffer.js';

/**
 * Traffic: every request is counted and timed into a one-minute bucket, which gives throughput, response time
 * percentiles and the share of client (4xx) and server (5xx) errors. The last hour is kept in memory; each bucket is
 * also written to the database once it has closed, for the longer trend charts.
 */

const MINUTE_MS = 60 * 1000;
const BUCKETS_KEPT = 60;
// Times kept per bucket for the percentiles. Past this a random share is kept, which still gives a fair picture.
const MAX_TIMES_PER_BUCKET = 5000;
const MAX_ROUTES_PER_BUCKET = 300;

const buckets = new RingBuffer(BUCKETS_KEPT);
let current = null;
// The next minute to hand on. A server that was idle for a minute still has that minute: with no requests.
let nextToFlush = Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

const newBucket = (start) => ({ start, requests: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, times: [], seen: 0, routes: new Map() });

const bucketFor = (now) => {
  const start = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  if (!current || current.start !== start) {
    if (current) buckets.push(current);
    current = newBucket(start);
  }
  return current;
};

export const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

export const recordRequest = ({ route, status, ms }) => {
  const bucket = bucketFor(Date.now());
  bucket.requests += 1;
  bucket[`status${Math.floor(status / 100)}xx`] = (bucket[`status${Math.floor(status / 100)}xx`] ?? 0) + 1;

  bucket.seen += 1;
  if (bucket.times.length < MAX_TIMES_PER_BUCKET) bucket.times.push(ms);
  else {
    const slot = Math.floor(Math.random() * bucket.seen);
    if (slot < MAX_TIMES_PER_BUCKET) bucket.times[slot] = ms;
  }

  const entry = bucket.routes.get(route) ?? (bucket.routes.size < MAX_ROUTES_PER_BUCKET ? { count: 0, totalMs: 0, maxMs: 0, errors: 0 } : null);
  if (!entry) return;
  entry.count += 1;
  entry.totalMs += ms;
  entry.maxMs = Math.max(entry.maxMs, ms);
  if (status >= 500) entry.errors += 1;
  bucket.routes.set(route, entry);
};

const summarise = (bucket) => {
  const sorted = [...bucket.times].sort((a, b) => a - b);
  return {
    start: new Date(bucket.start).toISOString(),
    requests: bucket.requests,
    status4xx: bucket.status4xx,
    status5xx: bucket.status5xx,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
};

const allBuckets = () => (current ? [...buckets.toArray(), current] : buckets.toArray());

const round = (value, digits = 1) => Number(value.toFixed(digits));

/**
 * The last few minutes in one view, plus a per-minute series for the chart.
 */
export const getTraffic = ({ minutes = 5, seriesMinutes = 30 } = {}) => {
  const now = Date.now();
  const all = allBuckets();
  const inWindow = all.filter((bucket) => bucket.start > now - minutes * MINUTE_MS);

  const totals = inWindow.reduce(
    (sum, bucket) => ({
      requests: sum.requests + bucket.requests,
      status2xx: sum.status2xx + bucket.status2xx,
      status3xx: sum.status3xx + bucket.status3xx,
      status4xx: sum.status4xx + bucket.status4xx,
      status5xx: sum.status5xx + bucket.status5xx,
    }),
    { requests: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0 }
  );
  const times = inWindow.flatMap((bucket) => bucket.times).sort((a, b) => a - b);

  // Slowest endpoints by average time, over the same window
  const routes = new Map();
  for (const bucket of inWindow) {
    for (const [route, entry] of bucket.routes) {
      const row = routes.get(route) ?? { route, count: 0, totalMs: 0, maxMs: 0, errors: 0 };
      row.count += entry.count;
      row.totalMs += entry.totalMs;
      row.maxMs = Math.max(row.maxMs, entry.maxMs);
      row.errors += entry.errors;
      routes.set(route, row);
    }
  }

  const elapsedSeconds = Math.max(1, Math.min(minutes * 60, (now - (inWindow[0]?.start ?? now)) / 1000));
  return {
    windowMinutes: minutes,
    requests: totals.requests,
    requestsPerSecond: round(totals.requests / elapsedSeconds, 2),
    statusCounts: { '2xx': totals.status2xx, '3xx': totals.status3xx, '4xx': totals.status4xx, '5xx': totals.status5xx },
    clientErrorPercent: totals.requests ? round((totals.status4xx / totals.requests) * 100) : 0,
    serverErrorPercent: totals.requests ? round((totals.status5xx / totals.requests) * 100) : 0,
    latencyMs: { p50: round(percentile(times, 50)), p95: round(percentile(times, 95)), p99: round(percentile(times, 99)) },
    slowestRoutes: [...routes.values()]
      .map(({ totalMs, ...row }) => ({ ...row, averageMs: round(totalMs / row.count), maxMs: round(row.maxMs) }))
      .sort((a, b) => b.averageMs - a.averageMs)
      .slice(0, 8),
    series: all.filter((bucket) => bucket.start > now - seriesMinutes * MINUTE_MS).map(summarise),
  };
};

const quietMinute = (start) => ({ start: new Date(start).toISOString(), requests: 0, status4xx: 0, status5xx: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 });

/**
 * Every minute that has ended and not yet been handed on, oldest first, each returned once. A minute with no requests
 * is included as zeros, so the history has no gaps.
 */
export const takeClosedMinutes = () => {
  const currentStart = Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
  const byStart = new Map(allBuckets().map((bucket) => [bucket.start, bucket]));
  const minutes = [];
  for (let start = Math.max(nextToFlush, currentStart - BUCKETS_KEPT * MINUTE_MS); start < currentStart; start += MINUTE_MS) {
    const bucket = byStart.get(start);
    minutes.push({ ...(bucket ? summarise(bucket) : quietMinute(start)), startMs: start });
  }
  nextToFlush = currentStart;
  return minutes;
};

export default { recordRequest, getTraffic, takeClosedMinutes, percentile };
