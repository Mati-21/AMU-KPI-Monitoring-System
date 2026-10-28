import crypto from 'crypto';
import { prisma } from '../../../config/database.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, TOKEN_TYPES, signToken, ttlToMs, verifyToken } from '../../../config/jwt.js';
import { forbidden, notFound, unauthorized } from '../../../utils/httpError.js';

/**
 * Server-tracked sessions (one UserSession row per logged-in device/browser).
 *
 * - Access tokens carry the session id (`sid`); `protect` rejects them once the session is revoked or expired.
 * - Refresh tokens are rotated on every use; only a SHA-256 hash of the current one is stored.
 *   Presenting an already-rotated token (outside a short grace window) is treated as theft and revokes the session.
 */

const MAX_SESSIONS_PER_USER = Number.parseInt(process.env.MAX_SESSIONS_PER_USER || '10', 10);
// Concurrent refreshes from several tabs of the same browser may present the just-rotated token
const REUSE_GRACE_MS = 30 * 1000;
// lastUsedAt is refreshed at most this often to avoid a write on every request
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

export const REVOKE_REASONS = Object.freeze({
  LOGOUT: 'logout',
  USER_REVOKED: 'revoked_by_user',
  SIGN_OUT_OTHERS: 'signed_out_other_sessions',
  PASSWORD_CHANGED: 'password_changed',
  PASSWORD_RESET: 'password_reset_by_admin',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  ADMIN_REVOKED: 'revoked_by_admin',
  TOKEN_REUSE: 'refresh_token_reuse_detected',
  SESSION_LIMIT: 'session_limit_exceeded',
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issueTokens = (account, sessionId) => {
  const refreshToken = signToken(TOKEN_TYPES.REFRESH, { id: account.id, sid: sessionId, jti: crypto.randomUUID() }, REFRESH_TOKEN_TTL);
  const token = signToken(
    TOKEN_TYPES.ACCESS,
    { id: account.id, personId: account.personId, username: account.username, sid: sessionId },
    ACCESS_TOKEN_TTL
  );
  return { token, refreshToken, refreshTokenHash: hashToken(refreshToken) };
};

const newExpiry = () => new Date(Date.now() + ttlToMs(REFRESH_TOKEN_TTL));

const activeWhere = (now = new Date()) => ({ revokedAt: null, expiresAt: { gt: now } });

/**
 * Keep at most MAX_SESSIONS_PER_USER active sessions: revoke the least recently used beyond the cap.
 */
const enforceSessionLimit = async (userAccountId) => {
  const active = await prisma.userSession.findMany({
    where: { userAccountId, ...activeWhere() },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true },
  });
  const excess = active.slice(MAX_SESSIONS_PER_USER).map((session) => session.id);
  if (excess.length > 0) {
    await prisma.userSession.updateMany({
      where: { id: { in: excess } },
      data: { revokedAt: new Date(), revokedReason: REVOKE_REASONS.SESSION_LIMIT },
    });
  }
};

/**
 * Start a new session after a fully completed login. Returns cookie tokens.
 */
export const createSession = async (account, { ipAddress, userAgent } = {}) => {
  const sessionId = crypto.randomUUID();
  const { token, refreshToken, refreshTokenHash } = issueTokens(account, sessionId);

  await prisma.userSession.create({
    data: { id: sessionId, userAccountId: account.id, refreshTokenHash, ipAddress, userAgent, expiresAt: newExpiry() },
  });
  await enforceSessionLimit(account.id);

  return { token, refreshToken, sessionId };
};

/**
 * Validate the session referenced by an access token. Used by `protect` on every request.
 */
export const validateSession = async (sessionId) => {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      userAccount: { select: { id: true, personId: true, username: true, isActive: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw unauthorized('Session has ended. Please login again.');
  }
  if (!session.userAccount.isActive) throw unauthorized('Account is unavailable or deactivated');

  if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.userSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  }

  return { sessionId: session.id, account: session.userAccount };
};

/**
 * Rotate the refresh token of a session and issue a new access token.
 */
export const refreshSession = async (refreshToken, { ipAddress, userAgent } = {}) => {
  if (!refreshToken) throw unauthorized('Refresh token missing. Please login again.');

  let decoded;
  try {
    decoded = verifyToken(refreshToken, TOKEN_TYPES.REFRESH);
  } catch {
    throw unauthorized('Refresh token expired or invalid. Please login again.');
  }

  const session = await prisma.userSession.findUnique({ where: { id: decoded.sid }, include: { userAccount: true } });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now) throw unauthorized('Session has ended. Please login again.');

  const presentedHash = hashToken(refreshToken);
  const isCurrent = presentedHash === session.refreshTokenHash;
  const isWithinGrace =
    presentedHash === session.previousRefreshTokenHash && session.rotatedAt && now - session.rotatedAt < REUSE_GRACE_MS;

  if (!isCurrent && !isWithinGrace) {
    await revokeSession(session.id, REVOKE_REASONS.TOKEN_REUSE);
    throw unauthorized('Refresh token was already used. The session has been revoked for safety; please login again.');
  }
  if (!session.userAccount.isActive) {
    await revokeSession(session.id, REVOKE_REASONS.ACCOUNT_DEACTIVATED);
    throw unauthorized('Account is unavailable or deactivated');
  }

  const tokens = issueTokens(session.userAccount, session.id);
  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      previousRefreshTokenHash: session.refreshTokenHash,
      refreshTokenHash: tokens.refreshTokenHash,
      rotatedAt: now,
      lastUsedAt: now,
      expiresAt: newExpiry(), // sliding window: active sessions stay alive, idle ones expire
      ipAddress: ipAddress ?? session.ipAddress,
      userAgent: userAgent ?? session.userAgent,
    },
  });

  return { token: tokens.token, refreshToken: tokens.refreshToken };
};

/**
 * Best-effort session id from the auth cookies (refresh token first, since the access token may have expired).
 */
export const sessionIdFromTokens = ({ accessToken, refreshToken }) => {
  for (const [token, type] of [
    [refreshToken, TOKEN_TYPES.REFRESH],
    [accessToken, TOKEN_TYPES.ACCESS],
  ]) {
    if (!token) continue;
    try {
      const { sid } = verifyToken(token, type);
      if (sid) return sid;
    } catch {
      // expired or invalid: try the next cookie
    }
  }
  return null;
};

export const revokeSession = (sessionId, reason) =>
  prisma.userSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

/**
 * Revoke every active session of an account, optionally keeping one (the caller's current session).
 */
export const revokeAllSessions = async (userAccountId, reason, { exceptSessionId } = {}) => {
  const result = await prisma.userSession.updateMany({
    where: { userAccountId, revokedAt: null, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return { revokedCount: result.count };
};

const SESSION_SELECT = {
  id: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  revokedReason: true,
};

/**
 * Sessions of an account, newest activity first. Active only unless includeRevoked.
 */
export const listSessions = async (userAccountId, { currentSessionId, includeRevoked = false } = {}) => {
  const sessions = await prisma.userSession.findMany({
    where: { userAccountId, ...(!includeRevoked && activeWhere()) },
    orderBy: { lastUsedAt: 'desc' },
    take: includeRevoked ? 50 : undefined,
    select: SESSION_SELECT,
  });
  return sessions.map((session) => ({
    ...session,
    isCurrent: session.id === currentSessionId,
    isActive: !session.revokedAt && session.expiresAt > new Date(),
  }));
};

/**
 * Revoke one of the caller's own sessions.
 */
export const revokeOwnSession = async (userAccountId, sessionId) => {
  const session = await prisma.userSession.findUnique({ where: { id: sessionId }, select: { userAccountId: true } });
  if (!session) throw notFound('Session not found');
  if (session.userAccountId !== userAccountId) throw forbidden('You can only revoke your own sessions');
  await revokeSession(sessionId, REVOKE_REASONS.USER_REVOKED);
};

export default {
  REVOKE_REASONS,
  createSession,
  validateSession,
  refreshSession,
  revokeSession,
  revokeAllSessions,
  listSessions,
  revokeOwnSession,
};
