import { prisma } from '../../config/database.js';
import { badRequest } from '../../utils/httpError.js';

/**
 * Module 11 — The Super Admin's system dashboard: what the system holds and how it is being used. Counts of users,
 * KPIs, themes and roles; who is online now; the latest activity in the audit log; and, asked for separately, how
 * many people logged in and how many logins there were, today by the hour or over the last 7 or 30 days by the day.
 * Performance itself is on the university dashboard.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = { today: 1, '7d': 7, '30d': 30 };
// A session used in the last 15 minutes counts as online
const ONLINE_WINDOW_MS = 15 * 60 * 1000;
// Days are counted on Ethiopian time (UTC+3), so a day's logins match the university's own day
const LOCAL_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const localDay = (date) => new Date(date.getTime() + LOCAL_OFFSET_MS).toISOString().slice(0, 10);
const localHour = (date) => new Date(date.getTime() + LOCAL_OFFSET_MS).getUTCHours();
const startOfLocalDay = (key) => new Date(new Date(`${key}T00:00:00Z`).getTime() - LOCAL_OFFSET_MS);

/**
 * The slots a range is counted in: today's hours so far, or the last 7 or 30 local days, oldest first.
 */
const slotsFor = (range, now) => {
  if (range === 'today') {
    const today = localDay(now);
    return Array.from({ length: localHour(now) + 1 }, (_, hour) => ({ key: `${today}T${hour}`, hour, matches: (date) => localDay(date) === today && localHour(date) === hour }));
  }
  const days = RANGES[range];
  return Array.from({ length: days }, (_, index) => {
    const date = localDay(new Date(now.getTime() - (days - 1 - index) * DAY_MS));
    return { key: date, date, weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()], matches: (moment) => localDay(moment) === date };
  });
};

const countStats = async () => {
  const [users, kpis, activeKpis, themes, roles] = await Promise.all([
    prisma.userAccount.count({ where: { isActive: true, person: { archivedAt: null } } }),
    prisma.kpi.count(),
    prisma.kpi.count({ where: { isActive: true } }),
    prisma.kpiTheme.count({ where: { parentThemeId: null } }),
    prisma.role.count(),
  ]);
  return { users, kpis, activeKpis, themes, roles };
};

/**
 * Successful logins in a range: for each hour or day, how many people logged in and how many logins there were.
 */
export const getSystemUsage = async ({ range = 'today' } = {}) => {
  if (!RANGES[range]) throw badRequest(`range must be one of: ${Object.keys(RANGES).join(', ')}`);
  const now = new Date();
  const slots = slotsFor(range, now);
  const since = startOfLocalDay(slots[0].date ?? localDay(now));
  const logins = await prisma.auditLog.findMany({
    where: { action: 'LOGIN_SUCCEEDED', createdAt: { gte: since } },
    select: { actorPersonId: true, createdAt: true },
  });
  return {
    range,
    unit: range === 'today' ? 'hour' : 'day',
    slots: slots.map(({ matches, ...slot }) => {
      const inSlot = logins.filter((login) => matches(login.createdAt));
      return { ...slot, activeUsers: new Set(inSlot.map((login) => login.actorPersonId)).size, logins: inSlot.length };
    }),
  };
};

/**
 * People with a live session used in the last few minutes, against every active account.
 */
const onlineStatus = async (now, totalUsers) => {
  const sessions = await prisma.userSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: now }, lastUsedAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) }, userAccount: { isActive: true } },
    select: { userAccountId: true },
    distinct: ['userAccountId'],
  });
  const online = sessions.length;
  return { online, offline: Math.max(0, totalUsers - online) };
};

const recentActivity = () =>
  prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { id: true, firstName: true, lastName: true } } },
  });

export const getSystemDashboard = async () => {
  const stats = await countStats();
  const [status, activity] = await Promise.all([onlineStatus(new Date(), stats.users), recentActivity()]);
  return { stats, status, activity };
};

export default { getSystemDashboard, getSystemUsage };
