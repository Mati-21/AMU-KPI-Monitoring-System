import { pool, prisma } from '../../../config/database.js';
import { getQueryTotals, getSlowQueries } from '../../../utils/queryTracker.js';

/**
 * The database: how many connections the server holds and whether any wait, how fast it answers, locks and
 * deadlocks, how often reads come from memory, and the slowest queries.
 */

const round = (value, digits = 1) => Number(Number(value).toFixed(digits));

export const poolStats = () => ({ total: pool.totalCount, idle: pool.idleCount, active: pool.totalCount - pool.idleCount, waiting: pool.waitingCount, max: pool.options.max });

/**
 * A round trip to the database. ok is false when it does not answer.
 */
export const pingDatabase = async () => {
  const start = process.hrtime.bigint();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: round(Number(process.hrtime.bigint() - start) / 1e6, 2) };
  } catch (error) {
    return { ok: false, latencyMs: null, error: error.message };
  }
};

// A view the database user may not be allowed to read gives nothing, not an error for the whole page
const quietly = (query) => query.catch(() => null);

export const getDatabase = async () => {
  const [ping, stats, activity, locks, size, recovery, replicas, version] = await Promise.all([
    pingDatabase(),
    quietly(
      prisma.$queryRaw`SELECT numbackends, xact_commit, xact_rollback, blks_read, blks_hit, deadlocks, temp_files, conflicts
                       FROM pg_stat_database WHERE datname = current_database()`
    ),
    quietly(
      prisma.$queryRaw`SELECT state, count(*)::int AS count,
                              COALESCE(max(EXTRACT(EPOCH FROM (now() - query_start))) FILTER (WHERE state = 'active'), 0) AS longest_seconds
                       FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() GROUP BY state`
    ),
    quietly(prisma.$queryRaw`SELECT count(*)::int AS waiting FROM pg_locks WHERE NOT granted`),
    quietly(prisma.$queryRaw`SELECT pg_database_size(current_database())::float AS bytes`),
    quietly(prisma.$queryRaw`SELECT pg_is_in_recovery() AS recovering`),
    quietly(prisma.$queryRaw`SELECT count(*)::int AS count, COALESCE(max(EXTRACT(EPOCH FROM replay_lag)), 0) AS lag_seconds FROM pg_stat_replication`),
    quietly(prisma.$queryRaw`SHOW server_version`),
  ]);

  const row = stats?.[0];
  const reads = row ? Number(row.blks_read) + Number(row.blks_hit) : 0;
  const states = Object.fromEntries((activity ?? []).map((entry) => [entry.state ?? 'unknown', entry.count]));
  const replicaCount = replicas?.[0]?.count ?? 0;

  return {
    reachable: ping.ok,
    latencyMs: ping.latencyMs,
    version: version?.[0]?.server_version ?? null,
    sizeBytes: size?.[0] ? Number(size[0].bytes) : null,
    pool: poolStats(),
    sessions: { active: states.active ?? 0, idle: states.idle ?? 0, idleInTransaction: states['idle in transaction'] ?? 0, longestQuerySeconds: round(Math.max(0, ...(activity ?? []).map((entry) => Number(entry.longest_seconds)))) },
    transactions: row ? { committed: Number(row.xact_commit), rolledBack: Number(row.xact_rollback) } : null,
    // Share of reads served from the database's own memory rather than the disk
    cacheHitPercent: reads > 0 ? round((Number(row.blks_hit) / reads) * 100) : null,
    locksWaiting: locks?.[0]?.waiting ?? null,
    deadlocks: row ? Number(row.deadlocks) : null,
    tempFiles: row ? Number(row.temp_files) : null,
    replication: { isReplica: Boolean(recovery?.[0]?.recovering), replicas: replicaCount, lagSeconds: replicaCount > 0 ? round(Number(replicas[0].lag_seconds), 2) : null },
    queries: { ...getQueryTotals(), slowest: getSlowQueries({ limit: 10 }) },
  };
};

export default { getDatabase, pingDatabase, poolStats };
