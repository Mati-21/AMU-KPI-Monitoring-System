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
const HOUR_MS = 60 * MINUTE_MS;
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

// The account part of a key: `${scope}|${ip}|${account}`
const accountOfKey = (key) => key.split('|').slice(2).join('|').toLowerCase();
const namesOf = (identifiers) => new Set(identifiers.filter(Boolean).map((name) => String(name).trim().toLowerCase()));

/**
 * Whether a person is locked out right now, under any of the names the attempts are counted by: the username or email
 * typed at sign-in, or the account id used for the code and password steps. lockedUntil is when the last block ends.
 */
export const lockStatusFor = async (identifiers, maxAttemptsKnown) => {
  const names = namesOf(identifiers);
  const maxAttempts = maxAttemptsKnown ?? (await getSetting('security', 'max_failed_attempts'));
  const now = Date.now();
  let until = 0;
  const steps = new Set();
  for (const [key, entry] of attempts) {
    if (entry.resetAt > now && entry.count >= maxAttempts && names.has(accountOfKey(key))) {
      until = Math.max(until, entry.resetAt);
      steps.add(key.split('|')[0]);
    }
  }
  return until ? { isLocked: true, lockedUntil: new Date(until).toISOString(), steps: [...steps] } : { isLocked: false, lockedUntil: null, steps: [] };
};

/**
 * lockStatusFor for a whole list of people at once, in the same order. Each item is the list of names to look under.
 */
export const lockStatusesFor = async (listOfIdentifiers) => {
  const maxAttempts = await getSetting('security', 'max_failed_attempts');
  return Promise.all(listOfIdentifiers.map((identifiers) => lockStatusFor(identifiers, maxAttempts)));
};

/**
 * Forget every failed attempt counted against a person, from any address, so they can try again at once.
 * Returns how many counters were cleared.
 */
export const clearAttemptsFor = (identifiers) => {
  const names = namesOf(identifiers);
  let cleared = 0;
  for (const key of [...attempts.keys()]) {
    if (names.has(accountOfKey(key))) {
      attempts.delete(key);
      cleared += 1;
    }
  }
  return cleared;
};

/**
 * Counts every request from an address, for public forms where a success is what is being limited.
 */
export const limitRequestsPerHour = (scope, settingKey) => async (req, res, next) => {
  const maxRequests = await getSetting('security', settingKey);
  const now = Date.now();
  const entry = currentEntry(`${scope}|${req.ip}`, now, HOUR_MS);
  if (entry.count >= maxRequests) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    throw tooManyRequests('Too many requests. Please try again later.');
  }
  entry.count += 1;
  next();
};

export default { limitFailedAttempts, limitRequestsPerHour, lockStatusFor, lockStatusesFor, clearAttemptsFor };
