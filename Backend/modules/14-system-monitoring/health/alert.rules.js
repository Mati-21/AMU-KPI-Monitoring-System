/**
 * When something is wrong enough to raise an alert. Each rule looks at the latest readings and answers either nothing
 * (all well) or { severity, message, value }. P1 needs action now; P2 is a warning. The limits are settings, under
 * System Monitoring in Configuration. Pure functions: no database, no clock, so each can be tested on its own.
 */

const MIN_REQUESTS_FOR_RATES = 20;
const CERTIFICATE_CRITICAL_DAYS = 3;
const SLOW_DATABASE_MS = 1000;
// A reading must stay high for a minute (six readings, ten seconds apart) before CPU counts as sustained
const SUSTAINED_READINGS = 6;

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round = (value) => Number(value.toFixed(1));
const lastReadings = (samples, field, count = SUSTAINED_READINGS) => samples.slice(-count).map((sample) => sample[field]);

export const RULES = [
  {
    key: 'database_down',
    title: 'Database not answering',
    evaluate: ({ latest }) => (latest.database.ok ? null : { severity: 'P1', message: `The database is not answering: ${latest.database.error ?? 'no reply'}.`, value: null }),
  },
  {
    key: 'subsystem_down',
    title: 'A part of the system is down',
    evaluate: ({ health }) => {
      const down = health.subsystems.filter((subsystem) => subsystem.status === 'down' && subsystem.key !== 'database');
      return down.length ? { severity: 'P1', message: down.map((subsystem) => `${subsystem.label}: ${subsystem.detail}`).join('. '), value: down.length } : null;
    },
  },
  {
    key: 'server_errors',
    title: 'Many requests are failing',
    evaluate: ({ traffic, thresholds }) =>
      traffic.requests >= MIN_REQUESTS_FOR_RATES && traffic.serverErrorPercent >= thresholds.error_rate_warning_percent
        ? { severity: 'P1', message: `${traffic.serverErrorPercent}% of requests failed with a server error in the last ${traffic.windowMinutes} minutes.`, value: traffic.serverErrorPercent }
        : null,
  },
  {
    key: 'disk_space',
    title: 'Disk is filling up',
    evaluate: ({ latest, thresholds }) => {
      const fullest = latest.host.disks.reduce((worst, disk) => (disk.percent > (worst?.percent ?? -1) ? disk : worst), null);
      if (!fullest || fullest.percent < thresholds.disk_warning_percent) return null;
      return { severity: fullest.percent >= thresholds.disk_critical_percent ? 'P1' : 'P2', message: `${fullest.label} is ${fullest.percent}% full.`, value: fullest.percent };
    },
  },
  {
    key: 'cpu_high',
    title: 'Processor overloaded',
    evaluate: ({ samples, thresholds }) => {
      const readings = lastReadings(samples, 'cpuPercent');
      const mean = average(readings);
      return readings.length === SUSTAINED_READINGS && mean >= thresholds.cpu_warning_percent ? { severity: 'P2', message: `The processor has averaged ${round(mean)}% for the last minute.`, value: round(mean) } : null;
    },
  },
  {
    key: 'memory_high',
    title: 'Memory nearly full',
    evaluate: ({ latest, thresholds }) =>
      latest.host.memory.percent >= thresholds.memory_warning_percent ? { severity: 'P2', message: `Memory is ${latest.host.memory.percent}% used.`, value: latest.host.memory.percent } : null,
  },
  {
    key: 'event_loop_lag',
    title: 'Server is slow to react',
    evaluate: ({ samples, thresholds }) => {
      const readings = lastReadings(samples, 'eventLoopP99Ms', 3);
      const mean = average(readings);
      return readings.length === 3 && mean >= thresholds.event_loop_lag_warning_ms ? { severity: 'P2', message: `The server has been taking about ${round(mean)} ms to react, which means it is overloaded or something is blocking it.`, value: round(mean) } : null;
    },
  },
  {
    key: 'slow_responses',
    title: 'Responses are slow',
    evaluate: ({ traffic, thresholds }) =>
      traffic.requests >= MIN_REQUESTS_FOR_RATES && traffic.latencyMs.p95 >= thresholds.latency_p95_warning_ms
        ? { severity: 'P2', message: `The slowest 5 in 100 requests took longer than ${traffic.latencyMs.p95} ms over the last ${traffic.windowMinutes} minutes.`, value: traffic.latencyMs.p95 }
        : null,
  },
  {
    key: 'database_saturated',
    title: 'Database is busy',
    evaluate: ({ latest }) => {
      const { ok, latencyMs, pool } = latest.database;
      if (!ok) return null;
      if (pool.waiting > 0) return { severity: 'P2', message: `${pool.waiting} requests are waiting for a free database connection (${pool.active} of ${pool.max} in use).`, value: pool.waiting };
      return latencyMs >= SLOW_DATABASE_MS ? { severity: 'P2', message: `The database took ${latencyMs} ms to answer a simple question.`, value: latencyMs } : null;
    },
  },
  {
    key: 'failed_logins',
    title: 'Many failed sign-ins',
    evaluate: ({ failedLogins10m, thresholds }) =>
      failedLogins10m >= thresholds.failed_logins_warning ? { severity: 'P2', message: `${failedLogins10m} failed sign-ins in the last 10 minutes. Someone may be guessing passwords.`, value: failedLogins10m } : null,
  },
  {
    key: 'certificate_expiring',
    title: 'Certificate is expiring',
    evaluate: ({ certificate, thresholds }) => {
      if (!certificate?.configured || certificate.daysLeft === undefined || certificate.daysLeft > thresholds.certificate_warning_days) return null;
      const expired = certificate.daysLeft < 0;
      return {
        severity: certificate.daysLeft <= CERTIFICATE_CRITICAL_DAYS ? 'P1' : 'P2',
        message: expired ? `The TLS certificate for ${certificate.host} expired ${-certificate.daysLeft} days ago.` : `The TLS certificate for ${certificate.host} expires in ${certificate.daysLeft} days.`,
        value: certificate.daysLeft,
      };
    },
  },
];

export default { RULES };
