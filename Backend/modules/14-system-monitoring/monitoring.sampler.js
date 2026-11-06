import { poolStats, pingDatabase } from './collectors/database.collector.js';
import { getCertificate } from './collectors/certificate.collector.js';
import { sampleHost } from './collectors/host.collector.js';
import { sampleProcess } from './collectors/process.collector.js';
import { recordBoot } from './collectors/release.info.js';
import { countFailedLogins } from './collectors/security.collector.js';
import { getTraffic, takeClosedMinutes } from './collectors/traffic.collector.js';
import { evaluateAlerts, loadOpenAlerts } from './health/alert.service.js';
import { checkSubsystems } from './health/subsystem.checks.js';
import { pruneRollups, saveRollups } from './store/rollup.store.js';
import { RingBuffer } from './store/ringBuffer.js';
import { setSlowQueryThreshold } from '../../utils/queryTracker.js';
import { getSettingsGroup } from '../10-system-governance/system.service.js';

/**
 * The heartbeat of System Monitoring. Every ten seconds it reads the machine, the process and the database, judges
 * the health of each part and checks the alert rules. Every minute it saves a summary and drops what is past
 * retention. Everything else (the dashboard) only reads what this has gathered, so watching costs nothing extra.
 */

const SAMPLE_MS = 10 * 1000;
const MINUTE_MS = 60 * 1000;
const SAMPLES_KEPT = 360; // an hour

const samples = new RingBuffer(SAMPLES_KEPT);
let state = null; // the latest reading of everything
let thresholds = null;
let running = false;
let lastMinuteDone = 0; // the clock minute whose housekeeping has run

const refreshThresholds = async () => {
  thresholds = await getSettingsGroup('monitoring');
  setSlowQueryThreshold(thresholds.slow_query_ms);
};

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const round = (value, digits = 1) => Number(value.toFixed(digits));

/**
 * Turn the minutes that have ended into rows for the history: their traffic, and the average load across them.
 */
const saveClosedMinutes = async () => {
  const closed = takeClosedMinutes();
  if (closed.length === 0) return;
  const readings = samples.toArray();
  const rollups = closed.map((minute) => {
    const within = readings.filter((sample) => sample.at >= minute.startMs && sample.at < minute.startMs + MINUTE_MS);
    const basis = within.length ? within : readings.slice(-1);
    return {
      bucketStart: new Date(minute.startMs),
      requests: minute.requests,
      status4xx: minute.status4xx,
      status5xx: minute.status5xx,
      p50Ms: minute.p50Ms,
      p95Ms: minute.p95Ms,
      p99Ms: minute.p99Ms,
      cpuPercent: round(average(basis.map((sample) => sample.cpuPercent))),
      memoryPercent: round(average(basis.map((sample) => sample.memoryPercent))),
      diskUsedPercent: basis.length ? basis[basis.length - 1].diskPercent : null,
      eventLoopLagMs: round(average(basis.map((sample) => sample.eventLoopP99Ms))),
      dbConnections: Math.round(average(basis.map((sample) => sample.dbConnections))),
    };
  });
  await saveRollups(rollups);
};

const everyMinute = async () => {
  await refreshThresholds();
  await saveClosedMinutes();
  await pruneRollups(thresholds.retention_days);
};

const tick = async () => {
  if (running) return;
  running = true;
  try {
    if (!thresholds) await refreshThresholds();
    const [host, ping] = await Promise.all([sampleHost(), pingDatabase()]);
    const process_ = sampleProcess();
    const pool = poolStats();

    samples.push({
      at: Date.now(),
      cpuPercent: host.cpu.percent,
      memoryPercent: host.memory.percent,
      diskPercent: host.disks.length ? Math.max(...host.disks.map((disk) => disk.percent)) : null,
      eventLoopP99Ms: process_.eventLoop.p99Ms,
      dbConnections: pool.total,
    });

    const latest = { at: new Date(), host, process: process_, database: { ...ping, pool } };
    const traffic = getTraffic({ minutes: 5 });
    const failedLogins10m = ping.ok ? await countFailedLogins(10) : 0;
    const health = await checkSubsystems({ latest, traffic, thresholds, failedLogins10m });
    const certificate = await getCertificate();

    state = { latest, traffic, health, failedLogins10m, certificate };
    await evaluateAlerts({ latest, traffic, health, failedLogins10m, certificate, thresholds, samples: samples.toArray() });

    // On the clock's minute, so a minute that has just ended is saved within one reading of ending
    const thisMinute = Math.floor(Date.now() / MINUTE_MS);
    if (thisMinute !== lastMinuteDone) {
      lastMinuteDone = thisMinute;
      if (ping.ok) await everyMinute();
    }
  } catch (error) {
    console.warn('[Monitoring] Could not take a reading:', error.message);
  } finally {
    running = false;
  }
};

/**
 * The newest reading. Right after start-up there is none yet, so it is taken on the spot.
 */
export const getState = async () => {
  if (!state) await tick();
  return state;
};

export const getThresholds = () => thresholds;

/**
 * The last ten minutes of load, for the live charts.
 */
export const getRecentSamples = (count = 60) =>
  samples.last(count).map(({ at, cpuPercent, memoryPercent, eventLoopP99Ms, dbConnections }) => ({ at: new Date(at).toISOString(), cpuPercent, memoryPercent, eventLoopLagMs: eventLoopP99Ms, dbConnections }));

export const startMonitoring = async () => {
  await recordBoot().catch((error) => console.warn('[Monitoring] Could not record the start:', error.message));
  await loadOpenAlerts().catch((error) => console.warn('[Monitoring] Could not load open alerts:', error.message));
  await tick();
  setInterval(tick, SAMPLE_MS).unref();
};

export default { startMonitoring, getState, getThresholds, getRecentSamples };
