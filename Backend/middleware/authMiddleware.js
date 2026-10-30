import { TOKEN_TYPES, verifyToken } from '../config/jwt.js';
import { validateSession } from '../modules/01-identity-access/auth/session.service.js';
import { SUPER_ADMIN_PERMISSION } from '../config/permissions.js';
import { getActiveGrants, hasGlobalPermission, hasPermission, isSuperAdmin } from '../modules/03-access-control/access.service.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

/**
 * Resolve the `token` cookie into req.user. The JWT must be an access token bound to a session (`sid`)
 * that is still active in the database, so revoking a session or deactivating an account takes effect immediately.
 */
const resolveSession = async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return null;

  try {
    const decoded = verifyToken(token, TOKEN_TYPES.ACCESS);
    if (!decoded.sid) throw unauthorized('Invalid session. Please login.');
    const { sessionId, account } = await validateSession(decoded.sid);
    return { id: account.id, personId: account.personId, username: account.username, sessionId };
  } catch (error) {
    res.clearCookie('token', { path: '/' });
    if (error.name === 'TokenExpiredError') throw unauthorized('Session expired, please login again');
    if (error.name === 'JsonWebTokenError') throw unauthorized('Invalid session. Please login.');
    throw error;
  }
};

/**
 * Cookie-only authentication: requires a valid HTTP-only `token` session cookie.
 */
export const protect = async (req, res, next) => {
  const user = await resolveSession(req, res);
  if (!user) throw unauthorized('Not authenticated. Session cookie missing.');
  req.user = user;
  next();
};

/**
 * Attach req.user when a valid session exists, but let the request through either way.
 * Used by auth steps that accept either a session or an `auth_stage` cookie.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    req.user = (await resolveSession(req, res)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
};

/**
 * Load (once per request) the caller's active permission grants and expose helpers on req.access.
 */
export const loadAccess = async (req) => {
  if (!req.access) {
    const grants = await getActiveGrants(req.user.personId);
    req.access = {
      grants,
      isSuperAdmin: isSuperAdmin(grants),
      can: (code, targetOfficeId) => hasPermission(grants, code, targetOfficeId),
      canGlobally: (code) => hasGlobalPermission(grants, code),
    };
  }
  return req.access;
};

/**
 * Route guard: caller must hold at least one of the given permission codes (in any office scope).
 * Office-scoped checks against a specific target are done in services via req.access.can(code, officeId).
 * Must be used after `protect`.
 */
export const requirePermission =
  (...codes) =>
  async (req, res, next) => {
    const access = await loadAccess(req);
    for (const code of codes) {
      if (await access.can(code)) return next();
    }
    throw forbidden(`Missing required permission: ${codes.join(' or ')}`);
  };

/**
 * Route guard: caller must hold the Super Admin wildcard permission.
 */
export const requireSuperAdmin = async (req, res, next) => {
  const access = await loadAccess(req);
  if (!access.isSuperAdmin) throw forbidden(`Super Admin permission (${SUPER_ADMIN_PERMISSION}) required`);
  next();
};

export default { protect, optionalAuth, loadAccess, requirePermission, requireSuperAdmin };
