import * as inboxService from './inbox.service.js';
import * as dispatchService from './dispatch.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

export const listMyNotifications = async (req, res) => {
  const { unreadOnly, page, limit } = req.query;
  res.json({ status: 'success', ...(await inboxService.listMyNotifications(req.user.personId, { unreadOnly, page, limit })) });
};
export const countUnread = async (req, res) => send(res, { count: await inboxService.countUnread(req.user.personId) });
export const markAsRead = async (req, res) => send(res, await inboxService.markAsRead(req.params.id, req.user.personId));
export const markAllAsRead = async (req, res) => send(res, await inboxService.markAllAsRead(req.user.personId));
export const dispatchNotification = async (req, res) => send(res, await dispatchService.dispatchNotification(req.body || {}, actorOf(req)), 201);
