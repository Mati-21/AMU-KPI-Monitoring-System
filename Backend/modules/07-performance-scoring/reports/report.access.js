import { PERMISSIONS } from '../../../config/permissions.js';
import { forbidden, notFound } from '../../../utils/httpError.js';

/**
 * Module 07 — Who may see and work on a report.
 * The reporting office sees its own draft. An office above sees a report only once it is submitted.
 */

const VISIBLE_TO_OFFICES_ABOVE = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'OVERDUE'];

/**
 * True when the actor's own grant sits on this office rather than on an office above it.
 */
const holdsOnThisOffice = (actor, code, officeId) => actor.access.grants.some((grant) => grant.code === code && grant.scopeOfficeId === officeId);

export const canSeeReport = async (actor, report) => {
  const { officeId } = report.contract;
  if (report.preparedByPersonId === actor.personId) return true;
  if (actor.access.canGlobally(PERMISSIONS.REPORT_READ)) return true;
  if (holdsOnThisOffice(actor, PERMISSIONS.REPORT_READ, officeId)) return true;
  return VISIBLE_TO_OFFICES_ABOVE.includes(report.status) && actor.access.can(PERMISSIONS.REPORT_READ, officeId);
};

export const assertCanSeeReport = async (actor, report) => {
  if (!(await canSeeReport(actor, report))) throw notFound('Report not found');
};

export const assertOfficeAuthority = async (actor, code, officeId) => {
  if (!(await actor.access.can(code, officeId))) throw forbidden(`You need ${code} authority over the reporting office`);
};

export default { canSeeReport, assertCanSeeReport, assertOfficeAuthority };
