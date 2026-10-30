import * as scorecardService from './scorecard.service.js';
import { actorOf } from '../../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

export const getOfficeScorecard = async (req, res) => {
  const { fiscalYearId, reportingPeriodId } = req.query;
  send(res, await scorecardService.getOfficeScorecard(req.params.officeId, { fiscalYearId, reportingPeriodId }, actorOf(req)));
};
export const getAssignmentPerformance = async (req, res) => send(res, await scorecardService.getAssignmentPerformance(req.params.id, actorOf(req)));
export const getKpiHistory = async (req, res) => send(res, await scorecardService.getKpiHistory(req.params.id, { officeId: req.query.officeId }, actorOf(req)));
