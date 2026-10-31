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

const assignmentEntity = (assignment) => ({ entityType: 'kpi_assignment', entityId: assignment.id });
const reportEntity = (report) => ({ entityType: 'performance_report', entityId: report.id });

// The office above decides. The top office has none, so those with university-wide authority do.
const fromAbove = (contract, code) => (contract.assigningOfficeId ? { targetOfficeId: contract.assigningOfficeId, requiredPermissionCode: code } : { requiredPermissionCode: code });
const receivingOffice = (contract, code) => ({ targetOfficeId: contract.officeId, requiredPermissionCode: code });

const kpiLabel = (assignment) => `${assignment.kpi.code} ${assignment.kpi.name}`;
const officeName = (contract) => contract.office?.name ?? 'An office';

// ===== Assignments =====

export const assignmentSubmitted = quietly((assignment, actor) =>
  event({ title: 'Assignment awaiting approval', message: `${kpiLabel(assignment)} for ${officeName(assignment.contract)} is waiting for approval.`, notificationType: 'ASSIGNMENT_SUBMITTED', ...assignmentEntity(assignment), ...fromAbove(assignment.contract, PERMISSIONS.CONTRACT_APPROVE) }, actor)
);

export const assignmentApproved = quietly((assignment, actor) =>
  event({ title: 'New KPI assigned', message: `${kpiLabel(assignment)} has been assigned to your office. Please review and acknowledge it.`, notificationType: 'ASSIGNMENT_APPROVED', ...assignmentEntity(assignment), ...receivingOffice(assignment.contract, PERMISSIONS.CONTRACT_ACKNOWLEDGE) }, actor)
);

export const assignmentRejected = quietly((assignment, comment, actor) =>
  event({ title: 'Assignment rejected', message: `${kpiLabel(assignment)} for ${officeName(assignment.contract)} was rejected: ${comment}`, notificationType: 'ASSIGNMENT_REJECTED', ...assignmentEntity(assignment), ...fromAbove(assignment.contract, PERMISSIONS.CONTRACT_MANAGE) }, actor)
);

// ===== Change requests =====

export const changeRequested = quietly((request, assignment, actor) =>
  event({ title: 'Change requested', message: `${officeName(assignment.contract)} asked for a ${request.requestType.toLowerCase()} on ${kpiLabel(assignment)}: ${request.reason}`, notificationType: 'CHANGE_REQUESTED', entityType: 'assignment_change_request', entityId: request.id, ...fromAbove(assignment.contract, PERMISSIONS.CONTRACT_APPROVE) }, actor)
);

export const changeReviewed = quietly((request, actor) =>
  event({ title: `Change request ${request.status.toLowerCase()}`, message: `Your request on ${request.assignment.kpi.code} was ${request.status.toLowerCase()}.${request.reviewComment ? ` ${request.reviewComment}` : ''}`, notificationType: 'CHANGE_REVIEWED', entityType: 'assignment_change_request', entityId: request.id, personIds: request.requestedByPersonId ? [request.requestedByPersonId] : [] }, actor)
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
    await event({ title: 'Office significantly below target', message: `${officeName(report.contract)} is at ${line.percent}% on ${line.kpiCode} for ${periodName(report)}.`, notificationType: 'LOW_PERFORMANCE', ...reportEntity(report), ...fromAbove(report.contract, PERMISSIONS.REPORT_REVIEW) }, actor);
  }
});
