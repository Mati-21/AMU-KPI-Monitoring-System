import * as fiscalYearService from './fiscalYear.service.js';
import * as catalogService from './catalog.service.js';
import * as kpiService from './kpi.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

// ===== Fiscal years =====
export const listFiscalYears = async (req, res) => send(res, await fiscalYearService.listFiscalYears());
export const createFiscalYear = async (req, res) => send(res, await fiscalYearService.createFiscalYear(req.body || {}, actorOf(req)), 201);
export const updateFiscalYear = async (req, res) => send(res, await fiscalYearService.updateFiscalYear(req.params.id, req.body || {}, actorOf(req)));
export const activateFiscalYear = async (req, res) => send(res, await fiscalYearService.activateFiscalYear(req.params.id, actorOf(req)));
export const closeFiscalYear = async (req, res) => send(res, await fiscalYearService.closeFiscalYear(req.params.id, req.body || {}, actorOf(req)));
export const reopenFiscalYear = async (req, res) => send(res, await fiscalYearService.reopenFiscalYear(req.params.id, req.body || {}, actorOf(req)));

// ===== Strategic objectives =====
export const listObjectives = async (req, res) => send(res, await catalogService.listObjectives({ isActive: req.query.isActive }));
export const createObjective = async (req, res) => send(res, await catalogService.createObjective(req.body || {}, actorOf(req)), 201);
export const updateObjective = async (req, res) => send(res, await catalogService.updateObjective(req.params.id, req.body || {}, actorOf(req)));

// ===== Themes =====
export const getThemeTree = async (req, res) => send(res, await catalogService.getThemeTree());
export const createTheme = async (req, res) => send(res, await catalogService.createTheme(req.body || {}, actorOf(req)), 201);
export const updateTheme = async (req, res) => send(res, await catalogService.updateTheme(req.params.id, req.body || {}, actorOf(req)));

// ===== Measurement units =====
export const listUnits = async (req, res) => send(res, await catalogService.listUnits());
export const createUnit = async (req, res) => send(res, await catalogService.createUnit(req.body || {}, actorOf(req)), 201);
export const updateUnit = async (req, res) => send(res, await catalogService.updateUnit(req.params.id, req.body || {}, actorOf(req)));

// ===== Reporting frequencies =====
export const listFrequencies = async (req, res) => send(res, await catalogService.listFrequencies());
export const createFrequency = async (req, res) => send(res, await catalogService.createFrequency(req.body || {}, actorOf(req)), 201);
export const updateFrequency = async (req, res) => send(res, await catalogService.updateFrequency(req.params.id, req.body || {}, actorOf(req)));

// ===== Scales =====
export const listScales = async (req, res) => send(res, await catalogService.listScales({ scaleType: req.query.scaleType }));
export const getScaleById = async (req, res) => send(res, await catalogService.getScaleById(req.params.id));
export const createScale = async (req, res) => send(res, await catalogService.createScale(req.body || {}, actorOf(req)), 201);
export const updateScale = async (req, res) => send(res, await catalogService.updateScale(req.params.id, req.body || {}, actorOf(req)));
export const setScaleScoring = async (req, res) => send(res, await catalogService.setScaleScoring(req.params.id, req.body || {}, actorOf(req)));

// ===== Currencies and exchange rates =====
export const listCurrencies = async (req, res) => send(res, await catalogService.listCurrencies());
export const createCurrency = async (req, res) => send(res, await catalogService.createCurrency(req.body || {}, actorOf(req)), 201);
export const updateCurrency = async (req, res) => send(res, await catalogService.updateCurrency(req.params.id, req.body || {}, actorOf(req)));
export const listExchangeRates = async (req, res) => {
  const { fromCurrencyId, toCurrencyId } = req.query;
  send(res, await catalogService.listExchangeRates({ fromCurrencyId, toCurrencyId }));
};
export const createExchangeRate = async (req, res) => send(res, await catalogService.createExchangeRate(req.body || {}, actorOf(req)), 201);

// ===== KPIs =====
export const listKpis = async (req, res) => {
  const { search, themeId, strategicObjectiveId, measurementType, direction, isActive, page, limit } = req.query;
  const result = await kpiService.listKpis({ search, themeId, strategicObjectiveId, measurementType, direction, isActive, page, limit });
  res.json({ status: 'success', ...result });
};
export const getKpiById = async (req, res) => send(res, await kpiService.getKpiById(req.params.id));
export const createKpi = async (req, res) => send(res, await kpiService.createKpi(req.body || {}, actorOf(req)), 201);
export const updateKpi = async (req, res) => send(res, await kpiService.updateKpi(req.params.id, req.body || {}, actorOf(req)));
