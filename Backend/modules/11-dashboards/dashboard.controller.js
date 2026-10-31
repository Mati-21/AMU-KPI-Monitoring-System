import * as universityService from './university.service.js';
import * as parentOfficeService from './parentOffice.service.js';
import * as officeDashboardService from './officeDashboard.service.js';
import { actorOf } from '../../utils/requestContext.js';

const send = (res, data) => res.json({ status: 'success', data });

const viewOf = ({ query: { fiscalYearId, reportingPeriodId } }) => ({ fiscalYearId, reportingPeriodId });

export const getUniversityDashboard = async (req, res) => send(res, await universityService.getUniversityDashboard(viewOf(req), actorOf(req)));
export const getParentOfficeDashboard = async (req, res) => send(res, await parentOfficeService.getParentOfficeDashboard(req.params.officeId, viewOf(req), actorOf(req)));
export const getOfficeDashboard = async (req, res) => send(res, await officeDashboardService.getOfficeDashboard(req.params.officeId, viewOf(req), actorOf(req)));
