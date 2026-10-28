import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== KPI evaluations =====

export const listEvaluations = async ({ evalCycleId, kpiTargetId, officeId, status } = {}) => notImplemented('listEvaluations');

/**
 * Enter or update the reported value for a target in an open cycle (upsert on kpiTargetId + evalCycleId).
 */
export const recordEvaluation = async ({ kpiTargetId, evalCycleId, reportedValue, comment }, actor) => notImplemented('recordEvaluation');

/**
 * Save reported values for many targets of one office scorecard at once.
 */
export const bulkRecordEvaluations = async ({ evalCycleId, items }, actor) => notImplemented('bulkRecordEvaluations');

/**
 * Evaluator confirms actualValue and finalizes the score (direction-aware).
 */
export const verifyEvaluation = async (id, { actualValue, comment }, actor) => notImplemented('verifyEvaluation');

// ===== Performance analytics =====

export const getOfficeScorecard = async (officeId, { evalCycleId, fiscalYearId } = {}) => notImplemented('getOfficeScorecard');

export const getInstitutionDashboard = async ({ fiscalYearId, evalCycleId } = {}) => notImplemented('getInstitutionDashboard');

export default {
  listEvaluations,
  recordEvaluation,
  bulkRecordEvaluations,
  verifyEvaluation,
  getOfficeScorecard,
  getInstitutionDashboard,
};
