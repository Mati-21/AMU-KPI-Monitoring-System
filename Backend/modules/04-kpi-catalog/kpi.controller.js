import * as kpiService from './kpi.service.js';

export const getKpis = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: [] });
  } catch (error) {
    next(error);
  }
};

export const getKpiById = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};

export const createKpi = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Create KPI ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const updateKpi = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Update KPI ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const deleteKpi = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Delete KPI ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getKpis,
  getKpiById,
  createKpi,
  updateKpi,
  deleteKpi,
};
