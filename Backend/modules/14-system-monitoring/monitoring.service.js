import { getDatabase } from './collectors/database.collector.js';
import { getRelease } from './collectors/release.info.js';
import { getSecurity } from './collectors/security.collector.js';
import { getTraffic } from './collectors/traffic.collector.js';
import { acknowledgeAlert, listAlerts } from './health/alert.service.js';
import { getRecentSamples, getState, getThresholds } from './monitoring.sampler.js';
import { getHistory } from './store/rollup.store.js';

/**
 * Module 14 — What System Monitoring shows. The machine, traffic and health come from the latest reading the
 * sampler took; the database and security views ask the database directly, because their answers change between
 * readings.
 */

const withThresholds = (thresholds) => ({
  cpuWarningPercent: thresholds.cpu_warning_percent,
  memoryWarningPercent: thresholds.memory_warning_percent,
  diskWarningPercent: thresholds.disk_warning_percent,
  diskCriticalPercent: thresholds.disk_critical_percent,
  eventLoopLagWarningMs: thresholds.event_loop_lag_warning_ms,
  errorRateWarningPercent: thresholds.error_rate_warning_percent,
  latencyP95WarningMs: thresholds.latency_p95_warning_ms,
});

/**
 * The top of the page: overall health, each part's status, open alerts, and which release is running.
 */
export const getOverview = async () => {
  const [state, release, alerts] = await Promise.all([getState(), getRelease(), listAlerts({ status: 'active' })]);
  return {
    takenAt: state.latest.at,
    health: state.health,
    alerts: { items: alerts, critical: alerts.filter((alert) => alert.severity === 'P1').length, warnings: alerts.filter((alert) => alert.severity === 'P2').length },
    release,
    system: state.latest.host.system,
  };
};

export const getHost = async () => {
  const state = await getState();
  return { takenAt: state.latest.at, ...state.latest.host, thresholds: withThresholds(getThresholds()), recent: getRecentSamples() };
};

export const getTrafficView = async () => {
  const state = await getState();
  // Traffic is counted as it happens, so it is read fresh rather than from the last ten-second reading
  return { takenAt: state.latest.at, traffic: getTraffic({ minutes: 5 }), process: state.latest.process, thresholds: withThresholds(getThresholds()), recent: getRecentSamples() };
};

export const getDatabaseView = async () => ({ takenAt: new Date(), ...(await getDatabase()) });

export const getSecurityView = async () => {
  const [security, state] = await Promise.all([getSecurity(), getState()]);
  return { takenAt: new Date(), ...security, failedLoginsLastTenMinutes: state.failedLogins10m };
};

export const getHistoryView = (range) => getHistory(range);

export { acknowledgeAlert, listAlerts };

export default { getOverview, getHost, getTrafficView, getDatabaseView, getSecurityView, getHistoryView, acknowledgeAlert, listAlerts };
