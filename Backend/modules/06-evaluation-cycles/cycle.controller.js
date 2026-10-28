import * as cycleService from './cycle.service.js';

export const getCycles = async (req, res, next) => {
  try {
    const cycles = await cycleService.getCycles();
    res.json({ status: 'success', data: cycles });
  } catch (error) {
    next(error);
  }
};

export const createCycle = async (req, res, next) => {
  try {
    res.status(201).json({ status: 'success', message: 'Cycle creation ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const updateCycleStatus = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Update cycle status ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const getOrInitiateReport = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Initiate report ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const submitReport = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Submit report ready to implement' });
  } catch (error) {
    next(error);
  }
};

export const reviewReport = async (req, res, next) => {
  try {
    res.json({ status: 'success', message: 'Review report ready to implement' });
  } catch (error) {
    next(error);
  }
};

export default {
  getCycles,
  createCycle,
  updateCycleStatus,
  getOrInitiateReport,
  submitReport,
  reviewReport,
};
