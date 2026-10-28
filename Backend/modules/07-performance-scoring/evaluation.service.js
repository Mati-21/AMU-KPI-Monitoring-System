import { prisma } from '../../config/database.js';

export const getEvaluations = async () => {
  // TODO: Implement getEvaluations
  return [];
};

export const getEvaluationById = async (id) => {
  // TODO: Implement getEvaluationById
  return null;
};

export const recordProgress = async (data) => {
  // TODO: Implement recordProgress
  return null;
};

export const verifyEvaluation = async (id, data) => {
  // TODO: Implement verifyEvaluation
  return null;
};

export const getOfficeScorecard = async (officeId, evalCycleId) => {
  // TODO: Implement getOfficeScorecard
  return null;
};

export default {
  getEvaluations,
  getEvaluationById,
  recordProgress,
  verifyEvaluation,
  getOfficeScorecard,
};
