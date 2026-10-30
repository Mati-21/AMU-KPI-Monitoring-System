import * as periodService from './period.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

export const listPeriods = async (req, res) => {
  const { fiscalYearId, frequencyId, isClosed } = req.query;
  send(res, await periodService.listPeriods({ fiscalYearId, frequencyId, isClosed }));
};
export const getPeriodById = async (req, res) => send(res, await periodService.getPeriodById(req.params.id));
export const createPeriod = async (req, res) => send(res, await periodService.createPeriod(req.body || {}, actorOf(req)), 201);
export const generatePeriods = async (req, res) => send(res, await periodService.generatePeriods(req.params.id, req.body || {}, actorOf(req)), 201);
export const updatePeriod = async (req, res) => send(res, await periodService.updatePeriod(req.params.id, req.body || {}, actorOf(req)));
export const closePeriod = async (req, res) => send(res, await periodService.closePeriod(req.params.id, req.body || {}, actorOf(req)));
export const reopenPeriod = async (req, res) => send(res, await periodService.reopenPeriod(req.params.id, req.body || {}, actorOf(req)));
export const deletePeriod = async (req, res) => {
  await periodService.deletePeriod(req.params.id, actorOf(req));
  res.json({ status: 'success', message: 'Reporting period deleted' });
};
