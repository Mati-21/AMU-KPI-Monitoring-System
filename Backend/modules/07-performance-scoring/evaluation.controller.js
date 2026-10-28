import * as evaluationService from './evaluation.service.js';

export const getEvaluations = async (req, res, next) => {
  try {
    const data = await evaluationService.getEvaluations();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

export const recordProgress = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Record progress ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const verifyEvaluation = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Verify evaluation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const getOfficeScorecard = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Scorecard ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getEvaluations,
  recordProgress,
  verifyEvaluation,
  getOfficeScorecard,
};
