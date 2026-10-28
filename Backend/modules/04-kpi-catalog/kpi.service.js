import { prisma } from '../../config/database.js';
import { notImplemented } from '../../utils/httpError.js';

// ===== Fiscal years =====

export const listFiscalYears = async () => notImplemented('listFiscalYears');

export const createFiscalYear = async ({ label, startDate, endDate }, actor) => notImplemented('createFiscalYear');

/**
 * Make one fiscal year active and close/deactivate the others.
 */
export const activateFiscalYear = async (id, actor) => notImplemented('activateFiscalYear');

// ===== Strategic themes =====

export const getThemeTree = async () => notImplemented('getThemeTree');

export const createTheme = async ({ name, code, parentThemeId, sortOrder }, actor) => notImplemented('createTheme');

// ===== Master KPIs =====

export const listKpis = async ({ search, kpiThemeId, direction, isActive } = {}) => notImplemented('listKpis');

export const getKpiById = async (id) => notImplemented('getKpiById');

export const createKpi = async (data, actor) => notImplemented('createKpi');

export const updateKpi = async (id, data, actor) => notImplemented('updateKpi');

export default {
  listFiscalYears,
  createFiscalYear,
  activateFiscalYear,
  getThemeTree,
  createTheme,
  listKpis,
  getKpiById,
  createKpi,
  updateKpi,
};
