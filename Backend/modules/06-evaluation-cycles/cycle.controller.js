import * as cycleService from './cycle.service.js';
import { actorOf } from '../../utils/requestContext.js';

export const listCycles = async (req, res) => {
  const { fiscalYearId, status } = req.query;
  const cycles = await cycleService.listCycles({ fiscalYearId, status });
  res.json({ status: 'success', data: cycles });
};

export const createCycle = async (req, res) => {
  const cycle = await cycleService.createCycle(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: cycle });
};

export const updateCycleStatus = async (req, res) => {
  const cycle = await cycleService.updateCycleStatus(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: cycle });
};

export const initiateReport = async (req, res) => {
  const report = await cycleService.initiateReport(req.body || {}, actorOf(req));
  res.status(201).json({ status: 'success', data: report });
};

export const getReportById = async (req, res) => {
  const report = await cycleService.getReportById(req.params.id, actorOf(req));
  res.json({ status: 'success', data: report });
};

export const submitReport = async (req, res) => {
  const report = await cycleService.submitReport(req.params.id, actorOf(req));
  res.json({ status: 'success', data: report });
};

export const reviewReport = async (req, res) => {
  const report = await cycleService.reviewReport(req.params.id, req.body || {}, actorOf(req));
  res.json({ status: 'success', data: report });
};

export default {
  listCycles,
  createCycle,
  updateCycleStatus,
  initiateReport,
  getReportById,
  submitReport,
  reviewReport,
};
