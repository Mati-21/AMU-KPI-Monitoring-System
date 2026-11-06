import { promises as fs, constants } from 'fs';
import { prisma } from '../../../config/database.js';
import { getIO } from '../../../realtime/socket.js';
import { UPLOAD_ROOT } from '../../08-evidence-documents/file.storage.js';

/**
 * A traffic-light for each part of the system: healthy (green), degraded (amber) or down (red). The whole system is
 * as healthy as its worst part. Only parts this system really has are listed: there are no outside webhooks.
 */

const SLOW_DATABASE_MS = 1000;
const MIN_REQUESTS_FOR_RATES = 20;
const RANK = { healthy: 0, degraded: 1, down: 2 };

const worst = (statuses) => statuses.reduce((current, status) => (RANK[status] > RANK[current] ? status : current), 'healthy');

const apiCheck = ({ latest, traffic, thresholds }) => {
  const lag = latest.process.eventLoop.p99Ms;
  const errors = traffic.serverErrorPercent;
  const busy = lag >= thresholds.event_loop_lag_warning_ms;
  const failing = traffic.requests >= MIN_REQUESTS_FOR_RATES && errors >= thresholds.error_rate_warning_percent;
  return {
    key: 'api',
    label: 'API server',
    status: busy || failing ? 'degraded' : 'healthy',
    detail: failing ? `${errors}% of requests failed in the last ${traffic.windowMinutes} minutes` : busy ? `Slow to react (${lag} ms)` : `${traffic.requestsPerSecond} requests per second`,
  };
};

const databaseCheck = ({ latest }) => {
  const { ok, latencyMs, pool, error } = latest.database;
  if (!ok) return { key: 'database', label: 'Database', status: 'down', detail: error ?? 'Not answering' };
  const saturated = pool.waiting > 0;
  return {
    key: 'database',
    label: 'Database',
    status: saturated || latencyMs >= SLOW_DATABASE_MS ? 'degraded' : 'healthy',
    detail: saturated ? `${pool.waiting} requests waiting for a connection` : `Answers in ${latencyMs} ms, ${pool.active} of ${pool.max} connections in use`,
  };
};

const authenticationCheck = async ({ thresholds, failedLogins10m }) => {
  try {
    const start = process.hrtime.bigint();
    const sessions = await prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const attacked = failedLogins10m >= thresholds.failed_logins_warning;
    return {
      key: 'authentication',
      label: 'Sign-in and sessions',
      status: attacked ? 'degraded' : 'healthy',
      detail: attacked ? `${failedLogins10m} failed sign-ins in the last 10 minutes` : `${sessions} open sessions, checked in ${ms.toFixed(0)} ms`,
    };
  } catch (error) {
    return { key: 'authentication', label: 'Sign-in and sessions', status: 'down', detail: error.message };
  }
};

const storageCheck = async ({ latest, thresholds }) => {
  try {
    await fs.access(UPLOAD_ROOT, constants.W_OK);
  } catch {
    return { key: 'storage', label: 'File storage', status: 'down', detail: 'The upload folder cannot be written to' };
  }
  const fullest = Math.max(0, ...latest.host.disks.map((disk) => disk.percent));
  const status = fullest >= thresholds.disk_critical_percent ? 'down' : fullest >= thresholds.disk_warning_percent ? 'degraded' : 'healthy';
  return { key: 'storage', label: 'File storage', status, detail: `Disk ${fullest}% full` };
};

const realtimeCheck = () => {
  try {
    const clients = getIO().engine.clientsCount;
    return { key: 'realtime', label: 'Live updates', status: 'healthy', detail: `${clients} open connection${clients === 1 ? '' : 's'}` };
  } catch {
    return { key: 'realtime', label: 'Live updates', status: 'down', detail: 'The live connection server is not running' };
  }
};

export const checkSubsystems = async (context) => {
  const subsystems = [apiCheck(context), databaseCheck(context), await authenticationCheck(context), await storageCheck(context), realtimeCheck()];
  return { overall: worst(subsystems.map((subsystem) => subsystem.status)), subsystems };
};

export default { checkSubsystems };
