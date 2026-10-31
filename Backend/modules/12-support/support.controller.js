import * as supportService from './support.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

export const createSupportRequest = async (req, res) => {
  const context = { personId: req.user?.personId, ipAddress: req.ip, userAgent: req.get('user-agent') || null };
  send(res, await supportService.createSupportRequest(req.body || {}, context), 201);
};
export const listSupportRequests = async (req, res) => {
  const { status, search, page, limit } = req.query;
  send(res, await supportService.listSupportRequests({ status, search, page, limit }));
};
export const getSupportRequest = async (req, res) => send(res, await supportService.getSupportRequest(req.params.id));
export const updateSupportRequest = async (req, res) => send(res, await supportService.updateSupportRequest(req.params.id, req.body || {}, actorOf(req)));
