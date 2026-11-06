const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return '-';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
};

export const formatPercent = (value) => (value === null || value === undefined ? '-' : `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`);

export const formatMs = (ms) => {
  if (ms === null || ms === undefined) return '-';
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s` : `${ms >= 100 ? Math.round(ms) : Number(ms.toFixed(1))} ms`;
};

export const formatNumber = (value) => (value === null || value === undefined ? '-' : Number(value).toLocaleString());

/**
 * "3d 4h", "2h 5m", "45s".
 */
export const formatDuration = (totalSeconds) => {
  if (totalSeconds === null || totalSeconds === undefined) return '-';
  const seconds = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const timeAgo = (value) => {
  if (!value) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
};

export const clockTime = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ===== Colours =====

export const GREEN = '#22c55e';
export const AMBER = '#f59e0b';
export const RED = '#ef4444';
export const BLUE = '#3b82f6';
export const PURPLE = '#8b5cf6';
export const SLATE = '#64748b';

export const STATUS = {
  healthy: { label: 'Healthy', color: GREEN, dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', soft: 'bg-green-50 dark:bg-green-950/50' },
  degraded: { label: 'Degraded', color: AMBER, dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', soft: 'bg-amber-50 dark:bg-amber-950/50' },
  down: { label: 'Down', color: RED, dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', soft: 'bg-red-50 dark:bg-red-950/50' },
};

export const SEVERITY = {
  P1: { ...STATUS.down, label: 'Critical' },
  P2: { ...STATUS.degraded, label: 'Warning' },
};

/**
 * Green until the warning limit, amber until the critical one, then red.
 */
export const levelColor = (value, warning, critical = Infinity) => (value >= critical ? RED : value >= warning ? AMBER : GREEN);

/**
 * "Chrome on Windows" from a browser's long identification text.
 */
export const describeBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : null;
  const system = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : null;
  return [browser, system].filter(Boolean).join(' on ') || userAgent.slice(0, 40);
};
