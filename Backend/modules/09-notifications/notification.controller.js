import * as notificationService from './notification.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listMyNotifications = async (req, res) => {
  const { unreadOnly, page, limit } = req.query;
  const result = await notificationService.listMyNotifications(req.user.personId, { unreadOnly, page, limit });
  res.json({ status: 'success', ...result });
};

export const countUnread = async (req, res) => {
  const count = await notificationService.countUnread(req.user.personId);
  res.json({ status: 'success', data: { count } });
};

export const markAsRead = async (req, res) => {
  const receipt = await notificationService.markAsRead(req.params.id, req.user.personId);
  res.json({ status: 'success', data: receipt });
};

export const markAllAsRead = async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user.personId);
  res.json({ status: 'success', data: result });
};

export const dispatchNotification = async (req, res) => {
  const notification = await notificationService.dispatchNotification(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: notification });
};

export default {
  listMyNotifications,
  countUnread,
  markAsRead,
  markAllAsRead,
  dispatchNotification,
};
