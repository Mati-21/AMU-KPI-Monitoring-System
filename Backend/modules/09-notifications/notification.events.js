import { PERMISSIONS } from '../../config/permissions.js';
import { sendNotification } from './dispatch.service.js';

/**
 * Module 09 — What the system tells people when something happens (SRS 15). One function per event.
 * A failed notification is logged and never undoes the action that triggered it.
 */

const quietly = (send) => async (...args) => {
  try {
    await send(...args);
  } catch (error) {
    console.warn('[Notifications] Could not send:', error.message);
  }
};

const event = (notification, actor) => sendNotification({ ...notification, excludePersonId: actor?.personId ?? null, createdByPersonId: actor?.personId ?? null });

const contractEntity = (contract) => ({ entityType: 'performance_contract', entityId: contract.id });
const reportEntity = (report) => ({ entityType: 'performance_report', entityId: report.id });

// The office above decides. The top office has none, so those with university-wide authority do.
const fromAbove = (contract, code) => (contract.assigningOfficeId ? { targetOfficeId: contract.assigningOfficeId, requiredPermissionCode: code } : { requiredPermissionCode: code });
// A staff contract goes to its one person; an office contract to whoever acts for that office
const receivingOffice = (contract, code) => (contract.personId ? { personIds: [contract.personId] } : { targetOfficeId: contract.officeId, requiredPermissionCode: code });

const kpiLabel = (assignment) => `"${assignment.kpi.name}"`;
const officeName = (contract) => (contract.person ? `${contract.person.firstName} ${contract.person.lastName}` : contract.office?.name ?? 'An office');

// ===== Support =====

export const supportRequestReceived = quietly((request) =>
  event({
    title: 'New support request',
    message: `${request.requesterName} sent a support request.`,
    notificationType: 'SUPPORT_REQUEST',
    entityType: 'support_request',
    entityId: request.id,
    requiredPermissionCode: PERMISSIONS.SUPPORT_MANAGE,
  })
);

// ===== Contracts =====

export const contractAssigned = quietly((contract, actor) =>
  event({ title: 'Contract to review', message: `A contract for ${officeName(contract)}, ${contract.fiscalYear.name}, is waiting for you to review and sign.`, notificationType: 'CONTRACT_ASSIGNED', ...contractEntity(contract), ...receivingOffice(contract, PERMISSIONS.CONTRACT_ACKNOWLEDGE) }, actor)
);

export const contractRejected = quietly((contract, reason, actor) =>
  event({ title: 'Contract rejected', message: `${officeName(contract)} rejected its contract for ${contract.fiscalYear.name}: ${reason}`, notificationType: 'CONTRACT_REJECTED', ...contractEntity(contract), ...fromAbove(contract, PERMISSIONS.CONTRACT_MANAGE) }, actor)
);

export const contractSigned = quietly((contract, actor) =>
  event({ title: 'Contract signed', message: `${officeName(contract)} signed its contract for ${contract.fiscalYear.name}.`, notificationType: 'CONTRACT_SIGNED', ...contractEntity(contract), ...fromAbove(contract, PERMISSIONS.CONTRACT_MANAGE) }, actor)
);

// ===== Change requests =====

export const changeRequested = quietly((request, assignment, actor) =>
  event({ title: 'Change requested', message: `${officeName(assignment.contract)} asked for a ${request.requestType.toLowerCase()} on ${kpiLabel(assignment)}: ${request.reason}`, notificationType: 'CHANGE_REQUESTED', entityType: 'assignment_change_request', entityId: request.id, ...fromAbove(assignment.contract, PERMISSIONS.CONTRACT_APPROVE) }, actor)
);

export const changeReviewed = quietly((request, actor) =>
  event({ title: `Change request ${request.status.toLowerCase()}`, message: `Your request on "${request.assignment.kpi.name}" was ${request.status.toLowerCase()}.${request.reviewComment ? ` ${request.reviewComment}` : ''}`, notificationType: 'CHANGE_REVIEWED', entityType: 'assignment_change_request', entityId: request.id, personIds: request.requestedByPersonId ? [request.requestedByPersonId] : [] }, actor)
);

// ===== Reports =====

const periodName = (report) => report.reportingPeriod?.name ?? 'this period';

export const reportSubmitted = quietly((report, actor) =>
  event({ title: 'Report awaiting review', message: `${officeName(report.contract)} submitted its ${periodName(report)} report.`, notificationType: 'REPORT_SUBMITTED', ...reportEntity(report), ...fromAbove(report.contract, PERMISSIONS.REPORT_REVIEW) }, actor)
);

const DECISION_WORDS = { APPROVED: 'approved', REJECTED: 'rejected', REVISION_REQUIRED: 'sent back for revision' };

export const reportReviewed = quietly((report, decision, comment, actor) =>
  event({ title: `Report ${DECISION_WORDS[decision]}`, message: `Your ${periodName(report)} report was ${DECISION_WORDS[decision]}.${comment ? ` ${comment}` : ''}`, notificationType: `REPORT_${decision}`, ...reportEntity(report), ...receivingOffice(report.contract, PERMISSIONS.REPORT_CREATE) }, actor)
);

export const reportReopened = quietly((report, reason, actor) =>
  event({ title: 'Approved report reopened', message: `Your ${periodName(report)} report was reopened for correction: ${reason}`, notificationType: 'REPORT_REOPENED', ...reportEntity(report), ...receivingOffice(report.contract, PERMISSIONS.REPORT_CREATE) }, actor)
);

/**
 * Tell the office above about each KPI below the university's alert level.
 */
export const lowPerformance = quietly(async (report, lowLines, actor) => {
  for (const line of lowLines) {
    await event({ title: 'Office significantly below target', message: `${officeName(report.contract)} is at ${line.percent}% on "${line.kpiName}" for ${periodName(report)}.`, notificationType: 'LOW_PERFORMANCE', ...reportEntity(report), ...fromAbove(report.contract, PERMISSIONS.REPORT_REVIEW) }, actor);
  }
});
