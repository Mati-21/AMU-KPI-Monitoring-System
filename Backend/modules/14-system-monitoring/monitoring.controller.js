import * as monitoringService from './monitoring.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

export const getOverview = async (req, res) => send(res, await monitoringService.getOverview());
export const getHost = async (req, res) => send(res, await monitoringService.getHost());
export const getTraffic = async (req, res) => send(res, await monitoringService.getTrafficView());
export const getDatabase = async (req, res) => send(res, await monitoringService.getDatabaseView());
export const getSecurity = async (req, res) => send(res, await monitoringService.getSecurityView());
export const getHistory = async (req, res) => send(res, await monitoringService.getHistoryView(req.query.range));
export const listAlerts = async (req, res) => send(res, await monitoringService.listAlerts({ status: req.query.status, limit: req.query.limit }));
export const acknowledgeAlert = async (req, res) => send(res, await monitoringService.acknowledgeAlert(req.params.id, actorOf(req)));
