import { getSetting } from '../modules/10-system-governance/system.service.js';
import { logActivity } from '../utils/auditLogger.js';
import { tooManyRequests } from '../utils/httpError.js';

/**
 * Stops password and MFA code guessing (settings: security.max_failed_attempts, security.lockout_minutes).
 * Failures are counted per account and client address, so one person's mistakes never block a whole office behind a
 * shared address, and a success clears the count. Counts live in memory: a restart clears them, and each server
 * instance counts on its own.
 */

const MAX_TRACKED_KEYS = 10000;
const MINUTE_MS = 60 * 1000;
const attempts = new Map();

const removeExpired = (now) => {
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
};

const currentEntry = (key, now, windowMs) => {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now) return entry;
  if (attempts.size >= MAX_TRACKED_KEYS) removeExpired(now);
  const fresh = { count: 0, resetAt: now + windowMs };
  attempts.set(key, fresh);
  return fresh;
};

const auditBlock = (req, scope, account) =>
  logActivity({
    action: 'LOGIN_BLOCKED',
    entityType: 'user_account',
    newValues: { scope, account: String(account).slice(0, 100) },
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  });

/**
 * accountOf(req) names the account being tried. The attempt is counted before it runs, so requests sent at the same
 * moment cannot slip past the limit; server errors say nothing about the guess and give the attempt back.
 */
export const limitFailedAttempts = (scope, accountOf) => async (req, res, next) => {
  const [maxAttempts, lockoutMinutes] = await Promise.all([getSetting('security', 'max_failed_attempts'), getSetting('security', 'lockout_minutes')]);
  const account = accountOf(req) ?? 'unknown';
  const key = `${scope}|${req.ip}|${account}`;
  const now = Date.now();
  const entry = currentEntry(key, now, lockoutMinutes * MINUTE_MS);

  if (entry.count >= maxAttempts) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    throw tooManyRequests('Too many failed attempts. Please wait and try again later.');
  }

  entry.count += 1;
  res.on('finish', () => {
    if (res.statusCode < 400) attempts.delete(key);
    else if (res.statusCode >= 500) entry.count -= 1;
    else if (entry.count === maxAttempts) auditBlock(req, scope, account);
  });
  next();
};

export default { limitFailedAttempts };
