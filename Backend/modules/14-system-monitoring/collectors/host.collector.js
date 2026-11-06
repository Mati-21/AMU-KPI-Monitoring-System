import { promises as fs, statSync } from 'fs';
import os from 'os';
import path from 'path';
import { UPLOAD_ROOT } from '../../08-evidence-documents/file.storage.js';

/**
 * The machine the server runs on: processor, memory, disks and network. Only what Node can read on every system is
 * measured. Swap and network throughput come from Linux's /proc and are left out elsewhere rather than guessed.
 */

const round = (value, digits = 1) => Number(value.toFixed(digits));
const percentOf = (used, total) => (total > 0 ? round((used / total) * 100) : 0);

// ===== Processor =====

let previousCpu = os.cpus().map((cpu) => cpu.times);

const busyAndTotal = (times) => {
  const total = Object.values(times).reduce((sum, value) => sum + value, 0);
  return { busy: total - times.idle, total };
};

/**
 * How busy each core was since the last time this was called.
 */
const sampleCpu = () => {
  const now = os.cpus().map((cpu) => cpu.times);
  const cores = now.map((times, index) => {
    const before = busyAndTotal(previousCpu[index] ?? times);
    const after = busyAndTotal(times);
    return percentOf(after.busy - before.busy, after.total - before.total);
  });
  previousCpu = now;
  const percent = cores.length ? round(cores.reduce((sum, value) => sum + value, 0) / cores.length) : 0;
  // Windows has no load average: Node reports zeros there
  const load = os.loadavg();
  return { percent, perCore: cores, loadAverage: load.some((value) => value > 0) ? load.map((value) => round(value, 2)) : null };
};

// ===== Memory and swap =====

const readProc = (file) => fs.readFile(file, 'utf8').catch(() => null);

const sampleMemory = () => {
  const total = os.totalmem();
  const used = total - os.freemem();
  return { totalBytes: total, usedBytes: used, percent: percentOf(used, total) };
};

const sampleSwap = async () => {
  const text = await readProc('/proc/meminfo');
  if (!text) return null;
  const kb = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1] ?? 0) * 1024;
  const total = kb('SwapTotal');
  if (total === 0) return { totalBytes: 0, usedBytes: 0, percent: 0 };
  const used = total - kb('SwapFree');
  return { totalBytes: total, usedBytes: used, percent: percentOf(used, total) };
};

// ===== Disks =====

const DISK_PATHS = [
  { label: 'Uploaded files', path: UPLOAD_ROOT },
  { label: 'Application', path: path.resolve(process.cwd()) },
];

const sampleDisks = async () => {
  const seen = new Set();
  const disks = [];
  for (const { label, path: target } of DISK_PATHS) {
    try {
      const device = statSync(target).dev;
      if (seen.has(device)) continue;
      seen.add(device);
      const stats = await fs.statfs(target);
      const total = stats.blocks * stats.bsize;
      const used = total - stats.bavail * stats.bsize;
      disks.push({ label, totalBytes: total, usedBytes: used, freeBytes: total - used, percent: percentOf(used, total) });
    } catch {
      // A folder that does not exist yet has no disk to report
    }
  }
  return disks;
};

// ===== Network =====

let previousNetwork = null;

/**
 * Bytes per second in and out, and packets dropped since the last call. Linux only.
 */
const sampleThroughput = async () => {
  const text = await readProc('/proc/net/dev');
  if (!text) return null;
  const totals = { rx: 0, tx: 0, dropped: 0 };
  for (const line of text.split('\n').slice(2)) {
    const [name, rest] = line.split(':');
    if (!rest || name.trim() === 'lo') continue;
    const fields = rest.trim().split(/\s+/).map(Number);
    totals.rx += fields[0];
    totals.dropped += fields[3] + fields[11];
    totals.tx += fields[8];
  }
  const now = Date.now();
  const before = previousNetwork;
  previousNetwork = { ...totals, at: now };
  if (!before) return { receiveBytesPerSecond: 0, sendBytesPerSecond: 0, droppedPackets: 0 };
  const seconds = Math.max(1, (now - before.at) / 1000);
  return {
    receiveBytesPerSecond: Math.round((totals.rx - before.rx) / seconds),
    sendBytesPerSecond: Math.round((totals.tx - before.tx) / seconds),
    droppedPackets: Math.max(0, totals.dropped - before.dropped),
  };
};

const interfaces = () =>
  Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? []).filter((address) => address.family === 'IPv4').map((address) => ({ name, address: address.address, internal: address.internal }))
  );

/**
 * One reading of everything. CPU percentages cover the time since the previous reading.
 */
export const sampleHost = async () => {
  const [swap, disks, throughput] = await Promise.all([sampleSwap(), sampleDisks(), sampleThroughput()]);
  return {
    cpu: { ...sampleCpu(), coreCount: os.cpus().length },
    memory: sampleMemory(),
    swap,
    disks,
    network: { interfaces: interfaces(), throughput },
    system: { platform: os.platform(), release: os.release(), architecture: os.arch(), hostname: os.hostname(), uptimeSeconds: Math.round(os.uptime()), bootedAt: new Date(Date.now() - os.uptime() * 1000).toISOString() },
  };
};

export default { sampleHost };
