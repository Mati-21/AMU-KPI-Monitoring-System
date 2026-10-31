import { prisma } from '../../config/database.js';
import { notFound } from '../../utils/httpError.js';
import { parseBooleanQuery, parseUuid } from '../../utils/validation.js';

/**
 * Module 09 — A person's own inbox. Everything here is limited to the person asking.
 */

const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  message: true,
  notificationType: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

export const listMyNotifications = async (personId, { unreadOnly, page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const where = { personId, ...(parseBooleanQuery(unreadOnly, 'unreadOnly') && { isRead: false }) };

  const [total, rows] = await Promise.all([
    prisma.notificationRecipient.count({ where }),
    prisma.notificationRecipient.findMany({
      where,
      orderBy: { notification: { createdAt: 'desc' } },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      select: { isRead: true, readAt: true, notification: { select: NOTIFICATION_SELECT } },
    }),
  ]);
  return {
    data: rows.map(({ notification, isRead, readAt }) => ({ ...notification, isRead, readAt })),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

export const countUnread = (personId) => prisma.notificationRecipient.count({ where: { personId, isRead: false } });

export const markAsRead = async (notificationId, personId) => {
  const id = parseUuid(notificationId, 'id');
  const owned = await prisma.notificationRecipient.count({ where: { notificationId: id, personId } });
  if (owned === 0) throw notFound('Notification not found');
  await prisma.notificationRecipient.updateMany({ where: { notificationId: id, personId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  return { id, isRead: true };
};

export const markAllAsRead = async (personId) => {
  const { count } = await prisma.notificationRecipient.updateMany({ where: { personId, isRead: false }, data: { isRead: true, readAt: new Date() } });
  return { markedRead: count };
};

export default { listMyNotifications, countUnread, markAsRead, markAllAsRead };
