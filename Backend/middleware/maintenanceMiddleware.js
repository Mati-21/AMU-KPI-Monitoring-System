import { PERMISSIONS } from '../config/permissions.js';
import { getSetting } from '../modules/10-system-governance/system.service.js';
import { loadAccess, optionalAuth } from './authMiddleware.js';

/**
 * Maintenance mode (setting system.maintenance_mode).
 * While on, the API answers 503 to everyone except university-wide settings managers, who can keep working and
 * switch it off. Login/session endpoints, public settings and dev helpers stay reachable so admins can sign in and
 * the frontend can show the maintenance page.
 */
const ALWAYS_ALLOWED = [/^\/auth\//, /^\/settings\/public$/, /^\/dev\//];

export const maintenanceGuard = async (req, res, next) => {
  if (ALWAYS_ALLOWED.some((pattern) => pattern.test(req.path))) return next();
  if (!(await getSetting('system', 'maintenance_mode'))) return next();

  await optionalAuth(req, res, () => {});
  if (req.user) {
    const access = await loadAccess(req);
    if (access.canGlobally(PERMISSIONS.SETTINGS_MANAGE)) return next();
  }

  const [message, endsAt] = await Promise.all([getSetting('system', 'maintenance_message'), getSetting('system', 'maintenance_ends_at')]);
  if (endsAt) {
    const seconds = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
    if (seconds > 0) res.set('Retry-After', String(seconds));
  }
  return res.status(503).json({ status: 'error', code: 'MAINTENANCE', message, maintenance: { endsAt } });
};

export default maintenanceGuard;
