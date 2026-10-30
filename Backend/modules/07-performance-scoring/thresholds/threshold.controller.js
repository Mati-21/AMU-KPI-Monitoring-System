import * as thresholdService from './threshold.service.js';
import { actorOf } from '../../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

export const listThresholds = async (req, res) => send(res, await thresholdService.listThresholds());
export const createThreshold = async (req, res) => send(res, await thresholdService.createThreshold(req.body || {}, actorOf(req)), 201);
export const updateThreshold = async (req, res) => send(res, await thresholdService.updateThreshold(req.params.id, req.body || {}, actorOf(req)));
