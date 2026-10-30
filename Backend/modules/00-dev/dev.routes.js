import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { SUPER_ADMIN_PERMISSION } from '../../config/permissions.js';
import { createSession } from '../01-identity-access/auth/session.service.js';
import { setSessionCookies } from '../01-identity-access/auth/auth.controller.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn } from '../../utils/dates.js';
import { forbidden, notFound } from '../../utils/httpError.js';

/**
 * DEVELOPMENT-ONLY helpers. This router is mounted (and documented in Swagger) only when
 * NODE_ENV === 'development' — see modules/index.js and config/swagger.js.
 */
export const isDevEnvironment = () => process.env.NODE_ENV === 'development';

const router = Router();

/**
 * Find the Super Admin account: ADMIN_USERNAME if it holds '*', otherwise the first active account holding '*'.
 */
const findSuperAdminAccount = async () => {
  const holdsWildcard = {
    isActive: true,
    person: {
      officePersons: {
        some: {
          ...activeOn('startDate', 'endDate'),
          roles: {
            some: {
              ...activeOn('validFrom', 'validTo'),
              scopeOfficeId: null,
              role: { permissions: { some: { permission: { code: SUPER_ADMIN_PERMISSION } } } },
            },
          },
        },
      },
    },
  };

  const preferred = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  return (
    (preferred && (await prisma.userAccount.findFirst({ where: { username: preferred, ...holdsWildcard } }))) ||
    prisma.userAccount.findFirst({ where: holdsWildcard, orderBy: { username: 'asc' } })
  );
};

/**
 * @swagger
 * tags:
 *   name: Dev
 *   description: Development-only helpers (not available when NODE_ENV is not "development")
 */

/**
 * @swagger
 * /api/v1/dev/login:
 *   post:
 *     summary: "DEV ONLY — log in as the Super Admin ('*') without password or MFA"
 *     description: Opens a normal tracked session for the Super Admin and sets the session cookies. Recorded in the audit log as DEV_QUICK_LOGIN.
 *     tags: [Dev]
 *     security: []
 *     responses:
 *       200: { description: Logged in as Super Admin }
 *       404: { description: No active account holds the '*' permission (run npm run seed:admin) }
 */
router.post('/dev/login', async (req, res) => {
  if (!isDevEnvironment()) throw forbidden('Development-only route');

  const account = await findSuperAdminAccount();
  if (!account) throw notFound("No active account holds the '*' permission. Run npm run seed:admin first.");

  const context = { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
  await prisma.userAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(account, context);
  setSessionCookies(res, session);

  await auditAction(
    { personId: account.personId, ...context },
    { action: 'DEV_QUICK_LOGIN', entityType: 'user_session', entityId: session.sessionId }
  );

  res.json({
    status: 'SUCCESS',
    message: `Logged in as ${account.username} (Super Admin) — development only`,
    user: { id: account.id, personId: account.personId, username: account.username },
  });
});

export default router;
