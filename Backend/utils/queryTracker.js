/**
 * Times every database query, so System Monitoring can list the slow ones. Only the statement is kept, with its
 * placeholders ($1, $2, ...): the values that went into it are never stored. Kept in memory, so a restart clears it.
 */

const MAX_SLOW_KEPT = 300;
const MAX_STATEMENT_LENGTH = 300;
// Monitoring's own look at the database must not show up as slow queries
const IGNORED = /pg_(stat|locks|database_size|is_in_recovery|backend_pid)|^\s*SELECT 1\b/i;

let slowThresholdMs = 500;
const slow = [];
const totals = { count: 0, totalMs: 0 };

export const setSlowQueryThreshold = (ms) => {
  slowThresholdMs = ms;
};

export const recordQuery = ({ query, duration }) => {
  totals.count += 1;
  totals.totalMs += duration;
  if (duration < slowThresholdMs || IGNORED.test(query)) return;
  slow.push({ at: Date.now(), ms: duration, statement: query.replace(/\s+/g, ' ').trim().slice(0, MAX_STATEMENT_LENGTH) });
  if (slow.length > MAX_SLOW_KEPT) slow.shift();
};

/**
 * The slowest statements in the last day, the same statement counted once with how often it was slow.
 */
export const getSlowQueries = ({ limit = 10, withinMs = 24 * 60 * 60 * 1000 } = {}) => {
  const since = Date.now() - withinMs;
  const byStatement = new Map();
  for (const entry of slow) {
    if (entry.at < since) continue;
    const row = byStatement.get(entry.statement) ?? { statement: entry.statement, count: 0, totalMs: 0, maxMs: 0, lastAt: 0 };
    row.count += 1;
    row.totalMs += entry.ms;
    row.maxMs = Math.max(row.maxMs, entry.ms);
    row.lastAt = Math.max(row.lastAt, entry.at);
    byStatement.set(entry.statement, row);
  }
  return [...byStatement.values()]
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, limit)
    .map(({ totalMs, ...row }) => ({ ...row, avgMs: Math.round(totalMs / row.count), maxMs: Math.round(row.maxMs), lastAt: new Date(row.lastAt).toISOString() }));
};

export const getQueryTotals = () => ({ count: totals.count, averageMs: totals.count ? Number((totals.totalMs / totals.count).toFixed(2)) : 0, slowThresholdMs });

export default { recordQuery, setSlowQueryThreshold, getSlowQueries, getQueryTotals };
