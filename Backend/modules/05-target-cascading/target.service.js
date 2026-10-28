import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

export const listTargets = async ({ fiscalYearId, officeId, kpiId, status } = {}) => notImplemented('listTargets');

export const getTargetTree = async ({ fiscalYearId, kpiId } = {}) => notImplemented('getTargetTree');

/**
 * Targets owned by or assigned to the current user's primary office.
 */
export const listMyTargets = async ({ fiscalYearId } = {}, actor) => notImplemented('listMyTargets');

/**
 * Set a top-level (root) institutional target.
 */
export const createTarget = async (data, actor) => notImplemented('createTarget');

/**
 * Split a parent target into child targets for sub-offices or people.
 * Must respect the KPI's cascadeMode and maxOverAllocationPercent cap.
 */
export const cascadeTarget = async (parentTargetId, { allocations }, actor) => notImplemented('cascadeTarget');

export const updateTarget = async (id, data, actor) => notImplemented('updateTarget');

export const updateTargetStatus = async (id, { status }, actor) => notImplemented('updateTargetStatus');

export default {
  listTargets,
  getTargetTree,
  listMyTargets,
  createTarget,
  cascadeTarget,
  updateTarget,
  updateTargetStatus,
};
