import * as notificationService from './notification.service.js';

export const getMyInbox = async (req, res, next) => {
  try {
    const result = await notificationService.getMyInbox(req.user?.personId);
    res.json({ status: 'success', ...result });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user?.personId);
    res.json({ status: 'success', unreadCount: count });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Mark as read ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Mark all read ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const dispatchNotification = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Notification dispatch ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyInbox,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
};
