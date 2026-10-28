import { prisma } from '../../config/database.js';

export const getMyInbox = async (personId) => {
  // TODO: Implement getMyInbox
  return { total: 0, unreadCount: 0, data: [] };
};

export const getUnreadCount = async (personId) => {
  // TODO: Implement getUnreadCount
  return 0;
};

export const markAsRead = async (id, personId) => {
  // TODO: Implement markAsRead
  return null;
};

export const markAllAsRead = async (personId) => {
  // TODO: Implement markAllAsRead
  return null;
};

export const dispatchNotification = async (data) => {
  // TODO: Implement dispatchNotification
  return null;
};

export default {
  getMyInbox,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
};
