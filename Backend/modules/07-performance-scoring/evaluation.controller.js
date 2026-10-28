import * as evaluationService from './evaluation.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listEvaluations = async (req, res) => {
  const { evalCycleId, kpiTargetId, officeId, status } = req.query;
  const evaluations = await evaluationService.listEvaluations({ evalCycleId, kpiTargetId, officeId, status });
  res.json({ status: 'success', data: evaluations });
};

export const recordEvaluation = async (req, res) => {
  const evaluation = await evaluationService.recordEvaluation(req.body || {}, actorOf(req));
  res.json({ status: 'success', data: evaluation });
};

export const bulkRecordEvaluations = async (req, res) => {
  const evaluations = await evaluationService.bulkRecordEvaluations(req.body || {}, actorOf(req));
  res.json({ status: 'success', data: evaluations });
};

export const verifyEvaluation = async (req, res) => {
  const evaluation = await evaluationService.verifyEvaluation(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: evaluation });
};

export const getOfficeScorecard = async (req, res) => {
  const { evalCycleId, fiscalYearId } = req.query;
  const scorecard = await evaluationService.getOfficeScorecard(req.params.officeId, { evalCycleId, fiscalYearId });
  res.json({ status: 'success', data: scorecard });
};

export const getInstitutionDashboard = async (req, res) => {
  const { fiscalYearId, evalCycleId } = req.query;
  const dashboard = await evaluationService.getInstitutionDashboard({ fiscalYearId, evalCycleId });
  res.json({ status: 'success', data: dashboard });
};

export default {
  listEvaluations,
  recordEvaluation,
  bulkRecordEvaluations,
  verifyEvaluation,
  getOfficeScorecard,
  getInstitutionDashboard,
};
