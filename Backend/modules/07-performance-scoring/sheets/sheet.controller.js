import * as sheetService from './sheet.service.js';
import { actorOf } from '../../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

export const listPerformanceOffices = async (req, res) => send(res, await sheetService.listPerformanceOffices({ fiscalYearId: req.query.fiscalYearId }, actorOf(req)));
export const getPerformanceSheet = async (req, res) => send(res, await sheetService.getPerformanceSheet({ fiscalYearId: req.query.fiscalYearId, officeId: req.query.officeId, contractId: req.query.contractId }, actorOf(req)));
export const getYearReport = async (req, res) => send(res, await sheetService.getYearReport({ fiscalYearId: req.query.fiscalYearId, officeId: req.query.officeId, contractId: req.query.contractId }, actorOf(req)));
