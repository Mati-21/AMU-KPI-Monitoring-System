import { prisma } from '../../../config/database.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, STAGE_TOKEN_TTL } from '../../../config/jwt.js';
import { SUPER_ADMIN_PERMISSION } from '../../../config/permissions.js';
import { activeOn } from '../../../utils/dates.js';
import { getCertificate } from './certificate.collector.js';

/**
 * Who is trying to get in, who holds the most powerful sessions, and the administrative actions that matter.
 * Everything comes from the audit log and the session table, so there is nothing extra to maintain.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const FAILED_LOGINS = ['LOGIN_FAILED', 'MFA_LOGIN_FAILED'];
// Actions that change who may do what, or how the system behaves
const CRITICAL_ACTIONS = [
  'ROLE_ASSIGNED',
  'ROLE_REVOKED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'ROLE_PERMISSIONS_SYNCED',
  'SETTINGS_UPDATED',
  'PASSWORD_RESET',
  'SESSIONS_REVOKED',
  'MFA_ENFORCEMENT_CHANGED',
  'MFA_DISABLED',
  'PERSON_ARCHIVED',
  'LOGIN_BLOCKED',
  'DEV_QUICK_LOGIN',
];

const since = (ms) => new Date(Date.now() - ms);

export const countFailedLogins = (minutes) => prisma.auditLog.count({ where: { action: { in: FAILED_LOGINS }, createdAt: { gte: since(minutes * MINUTE_MS) } } });

/**
 * Failed sign-ins for each of the last 24 hours, oldest first.
 */
const failuresByHour = async () => {
  const now = Date.now();
  const firstHour = Math.floor(now / HOUR_MS) * HOUR_MS - 23 * HOUR_MS;
  const rows = await prisma.auditLog.findMany({ where: { action: { in: FAILED_LOGINS }, createdAt: { gte: new Date(firstHour) } }, select: { createdAt: true }, take: 20000 });
  const counts = new Array(24).fill(0);
  for (const { createdAt } of rows) counts[Math.min(23, Math.floor((createdAt.getTime() - firstHour) / HOUR_MS))] += 1;
  return counts.map((failures, index) => ({ hour: new Date(firstHour + index * HOUR_MS).toISOString(), failures }));
};

/**
 * Sessions that are open right now for people holding the Super Admin permission.
 */
const adminSessions = async () => {
  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: now },
      userAccount: {
        isActive: true,
        person: {
          officePersons: {
            some: { ...activeOn('startDate', 'endDate'), roles: { some: { ...activeOn('validFrom', 'validTo'), role: { permissions: { some: { permission: { code: SUPER_ADMIN_PERMISSION } } } } } } },
          },
        },
      },
    },
    orderBy: { lastUsedAt: 'desc' },
    take: 20,
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true, userAccount: { select: { username: true, person: { select: { firstName: true, lastName: true } } } } },
  });
  return sessions.map((session) => ({
    id: session.id,
    username: session.userAccount.username,
    name: `${session.userAccount.person.firstName} ${session.userAccount.person.lastName}`.trim(),
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    startedAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  }));
};

export const getSecurity = async () => {
  const [lastTenMinutes, lastHour, lastDay, blockedDay, blockedHour, topAddresses, byHour, sessions, critical, certificate] = await Promise.all([
    countFailedLogins(10),
    countFailedLogins(60),
    countFailedLogins(24 * 60),
    prisma.auditLog.count({ where: { action: 'LOGIN_BLOCKED', createdAt: { gte: since(24 * HOUR_MS) } } }),
    prisma.auditLog.count({ where: { action: 'LOGIN_BLOCKED', createdAt: { gte: since(HOUR_MS) } } }),
    prisma.auditLog.groupBy({ by: ['ipAddress'], where: { action: { in: FAILED_LOGINS }, ipAddress: { not: null }, createdAt: { gte: since(24 * HOUR_MS) } }, _count: { _all: true }, orderBy: { _count: { ipAddress: 'desc' } }, take: 5 }),
    failuresByHour(),
    adminSessions(),
    prisma.auditLog.findMany({
      where: { action: { in: CRITICAL_ACTIONS } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, action: true, entityType: true, createdAt: true, ipAddress: true, actor: { select: { id: true, firstName: true, lastName: true } } },
    }),
    getCertificate(),
  ]);

  return {
    failedLogins: { lastTenMinutes, lastHour, lastDay, byHour, topAddresses: topAddresses.map((row) => ({ ipAddress: row.ipAddress, failures: row._count._all })) },
    rateLimit: { blockedLastHour: blockedHour, blockedLastDay: blockedDay },
    adminSessions: sessions,
    criticalActions: critical,
    certificate,
    sessionLifetimes: { access: ACCESS_TOKEN_TTL, refresh: REFRESH_TOKEN_TTL, loginStep: STAGE_TOKEN_TTL },
  };
};

export default { getSecurity, countFailedLogins };
