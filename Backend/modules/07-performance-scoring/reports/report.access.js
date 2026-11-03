import { prisma } from '../../../config/database.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { activeOn } from '../../../utils/dates.js';
import { getActiveGrants, ownOfficeOf } from '../../03-access-control/access.service.js';
import { hasAuthorityFromAbove, isOwnStaffContract, isStaffContract } from '../../05-contract-cascading/contract.shared.js';
import { forbidden, notFound } from '../../../utils/httpError.js';

/**
 * Module 07 — Who may see and work on a report.
 * The reporting office sees its own draft. An office above sees a report only once it is submitted, with report:read_all
 * or because it reviews that office.
 * A staff contract's report is seen by its person and by whoever reviews it: the head of their office, or for the
 * head's own work, the office above.
 */

const VISIBLE_TO_OFFICES_ABOVE = ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'OVERDUE'];

/**
 * True when the actor's own grant sits on this office rather than on an office above it.
 */
export const holdsOnThisOffice = (actor, code, officeId) => actor.access.grants.some((grant) => grant.code === code && ownOfficeOf(grant) === officeId);

/**
 * Whether the actor reviews one person's work: a staff member's goes to whoever reviews in their office, and the
 * work of someone who reviews there themselves goes to the office directly above. Nobody reviews their own.
 */
const reviewsStaffWork = async (actor, code, contract) => {
  if (isOwnStaffContract(actor, contract)) return false;
  if (actor.access.isSuperAdmin) return true;
  if (holdsOnThisOffice(actor, code, contract.officeId)) return true;

  const office = await prisma.office.findUnique({ where: { id: contract.officeId }, select: { parentOfficeId: true } });
  if (!office?.parentOfficeId || !holdsOnThisOffice(actor, code, office.parentOfficeId)) return false;
  const personGrants = await getActiveGrants(contract.personId);
  return personGrants.some((grant) => grant.code === code && ownOfficeOf(grant) === contract.officeId);
};

/**
 * Whether the actor reviews this contract's reports (report:review) or their evidence (evidence:verify).
 */
export const reviewsContract = (actor, code, contract) => (isStaffContract(contract) ? reviewsStaffWork(actor, code, contract) : hasAuthorityFromAbove(actor, code, contract));

export const assertReviewsContract = async (actor, code, contract) => {
  if (!(await reviewsContract(actor, code, contract))) throw forbidden(isStaffContract(contract) ? 'Only the head of this person\'s office reviews their results' : `You need ${code} authority over the office above, which reviews this report`);
};

export const canSeeReport = async (actor, report) => {
  const { contract } = report;
  if (report.preparedByPersonId === actor.personId) return true;
  if (actor.access.canGlobally(PERMISSIONS.REPORT_READ)) return true;
  if (isStaffContract(contract)) return isOwnStaffContract(actor, contract) || (VISIBLE_TO_OFFICES_ABOVE.includes(report.status) && reviewsStaffWork(actor, PERMISSIONS.REPORT_REVIEW, contract));
  if (holdsOnThisOffice(actor, PERMISSIONS.REPORT_READ, contract.officeId)) return true;
  if (!VISIBLE_TO_OFFICES_ABOVE.includes(report.status)) return false;
  return (await actor.access.can(PERMISSIONS.REPORT_READ, contract.officeId)) || actor.access.can(PERMISSIONS.REPORT_REVIEW, contract.officeId);
};

/**
 * The offices the person works in today. Their reports are the person's own; the others come from offices below.
 */
export const ownOfficeIdsOf = async (actor) => {
  const placements = await prisma.officePerson.findMany({ where: { personId: actor.personId, ...activeOn('startDate', 'endDate') }, select: { officeId: true } });
  return new Set(placements.map((placement) => placement.officeId));
};

/**
 * OWN when the report is the person's to send, BELOW when it is sent up to them. A staff contract is its person's
 * own, and comes up to everyone else who can see it, even in the same office.
 */
export const sideOf = (actor, contract, ownOfficeIds) => {
  if (isStaffContract(contract)) return isOwnStaffContract(actor, contract) ? 'OWN' : 'BELOW';
  return ownOfficeIds.has(contract.officeId) ? 'OWN' : 'BELOW';
};

export const assertCanSeeReport = async (actor, report) => {
  if (!(await canSeeReport(actor, report))) throw notFound('Report not found');
};

export const assertOfficeAuthority = async (actor, code, officeId) => {
  if (!(await actor.access.can(code, officeId))) throw forbidden(`You need ${code} authority over the reporting office`);
};

export default { holdsOnThisOffice, ownOfficeIdsOf, sideOf, canSeeReport, reviewsContract, assertReviewsContract, assertCanSeeReport, assertOfficeAuthority };
