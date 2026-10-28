import * as authService from './auth.service.js';
import * as sessionService from './session.service.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, STAGE_TOKEN_TTL, ttlToMs } from '../../../config/jwt.js';
import { badRequest, unauthorized } from '../../../utils/httpError.js';

const isProduction = process.env.NODE_ENV === 'production';

const BASE_COOKIE = { httpOnly: true, secure: isProduction, sameSite: 'lax' };
const SESSION_COOKIE = { ...BASE_COOKIE, path: '/', maxAge: ttlToMs(ACCESS_TOKEN_TTL) };
const STAGE_COOKIE = { ...BASE_COOKIE, path: '/', maxAge: ttlToMs(STAGE_TOKEN_TTL) };
// The refresh token is only ever sent to the auth endpoints
const REFRESH_COOKIE = { ...BASE_COOKIE, path: '/api/v1/auth', maxAge: ttlToMs(REFRESH_TOKEN_TTL) };

const clearAuthCookies = (res) => {
  res.clearCookie('token', { path: SESSION_COOKIE.path });
  res.clearCookie('auth_stage', { path: STAGE_COOKIE.path });
  res.clearCookie('refresh_token', { path: REFRESH_COOKIE.path });
};

const setSessionCookies = (res, { token, refreshToken }) => {
  res.cookie('token', token, SESSION_COOKIE);
  res.cookie('refresh_token', refreshToken, REFRESH_COOKIE);
  res.clearCookie('auth_stage', { path: STAGE_COOKIE.path });
};

/**
 * Move tokens from a service result into HTTP-only cookies; never expose them in the body.
 */
const sendAuthResult = (res, result) => {
  const { stageToken, token, refreshToken, ...body } = result;
  if (stageToken) {
    res.clearCookie('token', { path: SESSION_COOKIE.path });
    res.cookie('auth_stage', stageToken, STAGE_COOKIE);
  } else if (token) {
    setSessionCookies(res, { token, refreshToken });
  }
  res.json(body);
};

/**
 * MFA setup steps accept either an active session or an `auth_stage` cookie at the MFA_SETUP step.
 */
const resolveMfaSetupAccountId = (req) => {
  if (req.user) return req.user.id;
  if (!req.cookies?.auth_stage) throw unauthorized('Session cookie or MFA setup step cookie required');
  return authService.verifyStageToken(req.cookies.auth_stage, authService.STAGES.MFA_SETUP).id;
};

// Client details recorded on the session (shown in "active sessions")
const clientContext = (req) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') || null });

export const login = async (req, res) => {
  const result = await authService.authenticate(
    { identifier: req.body?.username || req.body?.email, password: req.body?.password },
    clientContext(req)
  );
  sendAuthResult(res, result);
};

export const changePasswordFirstLogin = async (req, res) => {
  const result = await authService.changePasswordFirstLogin(
    { stageToken: req.cookies?.auth_stage, newPassword: req.body?.newPassword },
    clientContext(req)
  );
  sendAuthResult(res, result);
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, code } = req.body || {};
  const result = await authService.changePassword({
    accountId: req.user.id,
    sessionId: req.user.sessionId,
    currentPassword,
    newPassword,
    code,
  });
  res.json(result);
};

export const setupMfa = async (req, res) => {
  const data = await authService.generateMfaSetup({ accountId: resolveMfaSetupAccountId(req) });
  res.json({ status: 'success', data });
};

export const verifyMfaSetup = async (req, res) => {
  if (!req.body?.code) throw badRequest('6-digit verification code is required');
  const result = await authService.verifyAndEnableMfa(
    // Only the login flow (no session yet) opens a new session
    { accountId: resolveMfaSetupAccountId(req), code: req.body.code, startSession: !req.user },
    clientContext(req)
  );
  sendAuthResult(res, result);
};

export const verifyMfa = async (req, res) => {
  if (!req.body?.code) throw badRequest('6-digit verification code is required');
  const result = await authService.verifyMfaLogin({ stageToken: req.cookies?.auth_stage, code: req.body.code }, clientContext(req));
  sendAuthResult(res, result);
};

export const disableMfa = async (req, res) => {
  if (!req.body?.code) throw badRequest('Verification code required to disable MFA');
  const result = await authService.disableMfa({ accountId: req.user.id, code: req.body.code });
  res.json({ status: 'success', ...result });
};

export const refreshToken = async (req, res) => {
  try {
    const tokens = await sessionService.refreshSession(req.cookies?.refresh_token, clientContext(req));
    setSessionCookies(res, tokens);
    res.json({ status: 'success', message: 'Session refreshed' });
  } catch (error) {
    clearAuthCookies(res);
    throw error;
  }
};

/**
 * Ends the current session server-side (works even if the access token has expired) and clears cookies.
 */
export const logout = async (req, res) => {
  const sessionId = sessionService.sessionIdFromTokens({ accessToken: req.cookies?.token, refreshToken: req.cookies?.refresh_token });
  if (sessionId) await sessionService.revokeSession(sessionId, sessionService.REVOKE_REASONS.LOGOUT);
  clearAuthCookies(res);
  res.json({ status: 'success', message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  res.json({ status: 'success', data: { ...profile, sessionId: req.user.sessionId } });
};

// ===== Own sessions =====

export const listMySessions = async (req, res) => {
  const sessions = await sessionService.listSessions(req.user.id, { currentSessionId: req.user.sessionId });
  res.json({ status: 'success', data: sessions });
};

export const revokeMySession = async (req, res) => {
  await sessionService.revokeOwnSession(req.user.id, req.params.id);
  if (req.params.id === req.user.sessionId) clearAuthCookies(res);
  res.json({ status: 'success', message: 'Session revoked' });
};

export const revokeMyOtherSessions = async (req, res) => {
  const result = await sessionService.revokeAllSessions(req.user.id, sessionService.REVOKE_REASONS.SIGN_OUT_OTHERS, {
    exceptSessionId: req.user.sessionId,
  });
  res.json({ status: 'success', message: `Signed out of ${result.revokedCount} other session(s)`, data: result });
};

export const enforceUserMfa = async (req, res) => {
  const enforced = req.body?.enforced ?? true;
  const updated = await authService.setMfaEnforced({ accountId: req.params.id, enforced });
  res.json({ status: 'success', message: `MFA enforcement for user set to ${updated.mfaEnforced}`, data: updated });
};

export const enforceRoleMfa = async (req, res) => {
  const { roleName, roleId, enforced = true } = req.body || {};
  const result = await authService.setMfaEnforcedForRole({ roleName, roleId, enforced });
  res.json({
    status: 'success',
    message: `2FA enforcement for role "${result.roleName}" set to ${result.mfaEnforced} (${result.affectedUsersCount} users updated)`,
    data: result,
  });
};

export default {
  login,
  changePasswordFirstLogin,
  changePassword,
  setupMfa,
  verifyMfaSetup,
  verifyMfa,
  disableMfa,
  refreshToken,
  logout,
  getMe,
  listMySessions,
  revokeMySession,
  revokeMyOtherSessions,
  enforceUserMfa,
  enforceRoleMfa,
};
