import * as reportService from './report.service.js';
import * as reportValueService from './reportValue.service.js';
import { actorOf } from '../../../utils/requestContext.js';

const send = (res, data, status = 200) => res.status(status).json({ status: 'success', data });

export const listReports = async (req, res) => {
  const { contractId, officeId, reportingPeriodId, fiscalYearId, status } = req.query;
  send(res, await reportService.listReports({ contractId, officeId, reportingPeriodId, fiscalYearId, status }, actorOf(req)));
};
export const getReportById = async (req, res) => send(res, await reportService.getReportById(req.params.id, actorOf(req)));
export const createReport = async (req, res) => send(res, await reportService.createReport(req.body || {}, actorOf(req)), 201);
export const saveValues = async (req, res) => send(res, await reportValueService.saveValues(req.params.id, req.body || {}, actorOf(req)));
export const submitReport = async (req, res) => send(res, await reportService.submitReport(req.params.id, actorOf(req)));
export const startReview = async (req, res) => send(res, await reportService.startReview(req.params.id, actorOf(req)));
export const reviewReport = async (req, res) => send(res, await reportService.reviewReport(req.params.id, req.body || {}, actorOf(req)));
