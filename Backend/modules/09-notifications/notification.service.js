import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

export const listMyNotifications = async (personId, { unreadOnly, page, limit } = {}) => notImplemented('listMyNotifications');

export const countUnread = async (personId) => notImplemented('countUnread');

/**
 * Mark one of the caller's notifications (by notification id) as read.
 */
export const markAsRead = async (notificationId, personId) => notImplemented('markAsRead');

export const markAllAsRead = async (personId) => notImplemented('markAllAsRead');

/**
 * Create a notification and resolve its recipients from the target office (optionally including
 * sub-offices) and/or a required permission, then push it over Socket.io.
 */
export const dispatchNotification = async (
  { title, message, targetOfficeId, includeSubOffices, requiredPermissionCode, entityType, entityId, channel },
  actor
) => notImplemented('dispatchNotification');

export default {
  listMyNotifications,
  countUnread,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
};
