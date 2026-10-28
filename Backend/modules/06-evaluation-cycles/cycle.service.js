import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Evaluation cycles =====

export const listCycles = async ({ fiscalYearId, status } = {}) => notImplemented('listCycles');

export const createCycle = async ({ fiscalYearId, name, periodStart, periodEnd, dueDate }, actor) => notImplemented('createCycle');

/**
 * Transition planned -> open -> in_review -> closed.
 */
export const updateCycleStatus = async (id, { status }, actor) => notImplemented('updateCycleStatus');

// ===== Cycle reports (one dossier per office per cycle) =====

/**
 * Create (or return the existing) draft report for an office in an open cycle.
 */
export const initiateReport = async ({ evalCycleId, officeId }, actor) => notImplemented('initiateReport');

export const getReportById = async (id, actor) => notImplemented('getReportById');

/**
 * Lock the report's draft evaluations and submit the dossier for review.
 */
export const submitReport = async (id, actor) => notImplemented('submitReport');

/**
 * Approve, reject or request changes, with a review note.
 */
export const reviewReport = async (id, { decision, reviewNote }, actor) => notImplemented('reviewReport');

export default {
  listCycles,
  createCycle,
  updateCycleStatus,
  initiateReport,
  getReportById,
  submitReport,
  reviewReport,
};
