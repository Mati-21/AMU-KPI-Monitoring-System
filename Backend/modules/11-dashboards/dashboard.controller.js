import * as universityService from './university.service.js';
import * as parentOfficeService from './parentOffice.service.js';
import * as officeDashboardService from './officeDashboard.service.js';
import * as personalDashboardService from './personalDashboard.service.js';
import * as systemDashboardService from './systemDashboard.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

const viewOf = ({ query: { fiscalYearId, reportingPeriodId } }) => ({ fiscalYearId, reportingPeriodId });

export const getUniversityDashboard = async (req, res) => send(res, await universityService.getUniversityDashboard(viewOf(req), actorOf(req)));
export const getParentOfficeDashboard = async (req, res) => send(res, await parentOfficeService.getParentOfficeDashboard(req.params.officeId, viewOf(req), actorOf(req)));
export const getSystemDashboard = async (req, res) => send(res, await systemDashboardService.getSystemDashboard());
export const getSystemUsage = async (req, res) => send(res, await systemDashboardService.getSystemUsage({ range: req.query.range }));
export const getMyDashboard = async (req, res) => send(res, await personalDashboardService.getMyDashboard({ ...viewOf(req), contractId: req.query.contractId }, actorOf(req)));
export const getOfficeDashboard = async (req, res) => send(res, await officeDashboardService.getOfficeDashboard(req.params.officeId, viewOf(req), actorOf(req)));
