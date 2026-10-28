import * as kpiService from './kpi.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listFiscalYears = async (req, res) => {
  const fiscalYears = await kpiService.listFiscalYears();
  res.json({ status: 'success', data: fiscalYears });
};

export const createFiscalYear = async (req, res) => {
  const fiscalYear = await kpiService.createFiscalYear(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: fiscalYear });
};

export const activateFiscalYear = async (req, res) => {
  const fiscalYear = await kpiService.activateFiscalYear(req.params.id, actorOf(req));
  res.json({ status: 'success', data: fiscalYear });
};

export const getThemeTree = async (req, res) => {
  const themes = await kpiService.getThemeTree();
  res.json({ status: 'success', data: themes });
};

export const createTheme = async (req, res) => {
  const theme = await kpiService.createTheme(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: theme });
};

export const listKpis = async (req, res) => {
  const { search, kpiThemeId, direction, isActive } = req.query;
  const kpis = await kpiService.listKpis({ search, kpiThemeId, direction, isActive });
  res.json({ status: 'success', data: kpis });
};

export const getKpiById = async (req, res) => {
  const kpi = await kpiService.getKpiById(req.params.id);
  res.json({ status: 'success', data: kpi });
};

export const createKpi = async (req, res) => {
  const kpi = await kpiService.createKpi(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: kpi });
};

export const updateKpi = async (req, res) => {
  const kpi = await kpiService.updateKpi(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: kpi });
};

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
