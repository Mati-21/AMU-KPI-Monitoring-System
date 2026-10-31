import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseEnum, parseUuid, requireString } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { changeRequested, changeReviewed } from '../09-notifications/notification.events.js';
import { refreshReconciliation } from './allocation.service.js';
import { APPROVED_STATUSES, addVersion, assertAuthorityFromAbove, assertSeparateApprover, canSeeAssignment, getAssignmentOrThrow, requireComment } from './contract.shared.js';
import { parseBaseline, parseTarget, parseWeight } from './measurement.js';

/**
 * Module 05 — Change requests: the only way to change an approved baseline, target or weight (SRS 4.3, 11.2).
 * Approving adds new versions. The old values stay, so past results remain traceable.
 */

const REQUEST_TYPES = ['CLARIFICATION', 'CORRECTION', 'MODIFICATION'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const REQUEST_INCLUDE = {
  assignment: {
    select: {
      id: true,
      status: true,
      kpi: { select: { id: true, code: true, name: true } },
      contract: { select: { id: true, officeId: true, assigningOfficeId: true, fiscalYearId: true, office: { select: { id: true, name: true } } } },
    },
  },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
  evidence: true,
};

const getRequestOrThrow = async (id) => {
  const request = await prisma.assignmentChangeRequest.findUnique({ where: { id: parseUuid(id, 'id') }, include: REQUEST_INCLUDE });
  if (!request) throw notFound('Change request not found');
  return request;
};

/**
 * The receiving office asks; the assigning side may also start a change.
 */
const assertMayRequest = async (actor, contract) => {
  if (await actor.access.can(PERMISSIONS.CONTRACT_REQUEST_CHANGE, contract.officeId)) return;
  if (contract.assigningOfficeId && (await actor.access.can(PERMISSIONS.CONTRACT_MANAGE, contract.assigningOfficeId))) return;
  if (!contract.assigningOfficeId && actor.access.canGlobally(PERMISSIONS.CONTRACT_MANAGE)) return;
  throw forbidden('You cannot request changes to this assignment');
};

const parseProposal = (kpi, proposed = {}) => {
  if (typeof proposed !== 'object' || proposed === null) throw badRequest('proposedValues must be an object');
  const parsed = {};
  if (proposed.baseline !== undefined) parsed.baseline = parseBaseline(kpi, proposed.baseline, 'proposedValues.baseline');
  if (proposed.target !== undefined) parsed.target = parseTarget(kpi, proposed.target, 'proposedValues.target');
  if (proposed.weight !== undefined) parsed.weight = parseWeight(proposed.weight, 'proposedValues.weight');
  return parsed;
};

export const createChangeRequest = async (assignmentId, { requestType, reason, proposedValues, evidenceDocumentIds } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(assignmentId);
  await assertFiscalYearOpen(assignment.contract.fiscalYearId);
  await assertMayRequest(actor, assignment.contract);
  if (!APPROVED_STATUSES.includes(assignment.status)) throw conflict(`Only an approved assignment takes change requests; this one is ${assignment.status}`);

  const type = parseEnum(requestType, 'requestType', REQUEST_TYPES);
  const cleanReason = requireString(reason, 'reason');
  const proposal = parseProposal(assignment.kpi, proposedValues);
  if (type === 'CLARIFICATION' && Object.keys(proposal).length > 0) throw badRequest('A clarification proposes no values');
  if (type !== 'CLARIFICATION' && Object.keys(proposal).length === 0) throw badRequest(`A ${type} must propose a baseline, target or weight`);

  if (type !== 'CLARIFICATION') {
    const pending = await prisma.assignmentChangeRequest.findFirst({ where: { assignmentId: assignment.id, status: 'PENDING', requestType: { not: 'CLARIFICATION' } } });
    if (pending) throw conflict('This assignment already has a change request waiting for review');
  }

  if (evidenceDocumentIds !== undefined && !Array.isArray(evidenceDocumentIds)) throw badRequest('evidenceDocumentIds must be a list');
  const documentIds = [...new Set(evidenceDocumentIds ?? [])];
  documentIds.forEach((id, index) => parseUuid(id, `evidenceDocumentIds[${index}]`));
  if ((await prisma.document.count({ where: { id: { in: documentIds } } })) !== documentIds.length) throw badRequest('Evidence document not found');

  const request = await prisma.assignmentChangeRequest.create({
    data: {
      assignmentId: assignment.id,
      requestType: type,
      requestedByPersonId: actor.personId,
      proposedValues: proposal,
      reason: cleanReason,
      evidence: { create: documentIds.map((documentId) => ({ documentId })) },
    },
    include: REQUEST_INCLUDE,
  });
  await auditAction(actor, { action: 'CHANGE_REQUESTED', entityType: 'assignment_change_request', entityId: request.id, newValues: { assignmentId: assignment.id, requestType: type, proposal }, reason: cleanReason });
  await changeRequested(request, assignment, actor);
  return request;
};

/**
 * Requests the actor can see, on assignments they can see.
 */
export const listChangeRequests = async ({ status, assignmentId, officeId } = {}, actor) => {
  const requests = await prisma.assignmentChangeRequest.findMany({
    where: {
      ...(status && { status: parseEnum(status, 'status', STATUSES) }),
      ...(assignmentId && { assignmentId: parseUuid(assignmentId, 'assignmentId') }),
      ...(officeId && { assignment: { contract: { officeId: parseUuid(officeId, 'officeId') } } }),
    },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  const visible = [];
  for (const request of requests) {
    if (await canSeeAssignment(actor, request.assignment.contract, request.assignment.status)) visible.push(request);
  }
  return visible;
};

export const getChangeRequestById = async (id, actor) => {
  const request = await getRequestOrThrow(id);
  if (!(await canSeeAssignment(actor, request.assignment.contract, request.assignment.status))) throw notFound('Change request not found');
  return request;
};

/**
 * Decide a request. Approval writes the proposed values as new versions, approved by the reviewer. A changed weight
 * can leave the contract total off; the contract then reports isWeightBalanced false.
 */
export const reviewChangeRequest = async (id, { decision, comment, effectiveFromPeriodId } = {}, actor) => {
  const request = await getRequestOrThrow(id);
  const { contract } = request.assignment;
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, contract);
  if (request.status !== 'PENDING') throw conflict(`This request was already ${request.status}`);
  await assertSeparateApprover(actor, request.requestedByPersonId);

  const outcome = parseEnum(decision, 'decision', ['APPROVED', 'REJECTED']);
  const reviewComment = outcome === 'REJECTED' ? requireComment(comment) : optionalString(comment, 'comment') ?? null;

  const periodId = parseUuid(effectiveFromPeriodId, 'effectiveFromPeriodId', { required: false }) ?? null;
  if (periodId) {
    const period = await prisma.reportingPeriod.findUnique({ where: { id: periodId }, select: { fiscalYearId: true } });
    if (period?.fiscalYearId !== contract.fiscalYearId) throw badRequest('effectiveFromPeriodId must be a period of the same fiscal year');
  }

  const proposal = request.proposedValues ?? {};
  const personId = actor.personId;
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const links = {};
    if (outcome === 'APPROVED') {
      const common = { reason: request.reason, createdByPersonId: request.requestedByPersonId };
      if (proposal.baseline) {
        const isKnown = proposal.baseline.baselineStatus === 'KNOWN';
        const row = await addVersion(tx, tx.kpiBaseline, request.assignmentId, {
          ...proposal.baseline,
          ...common,
          effectiveFromPeriodId: periodId,
          // The reviewer checked the evidence behind a known value when approving it
          ...(isKnown && { baselineStatus: 'VERIFIED', verifiedByPersonId: personId, verifiedAt: now }),
        });
        links.newBaselineId = row.id;
      }
      if (proposal.target) {
        const row = await addVersion(tx, tx.kpiTarget, request.assignmentId, { ...proposal.target, ...common, effectiveFromPeriodId: periodId, approvedByPersonId: personId, approvedAt: now });
        links.newTargetId = row.id;
      }
      if (proposal.weight !== undefined) {
        const row = await addVersion(tx, tx.kpiWeight, request.assignmentId, { weight: proposal.weight, ...common, approvedByPersonId: personId, approvedAt: now });
        links.newWeightId = row.id;
      }
    }
    return tx.assignmentChangeRequest.update({
      where: { id: request.id },
      data: { status: outcome, reviewedByPersonId: personId, reviewedAt: now, reviewComment, ...links },
      include: REQUEST_INCLUDE,
    });
  });
  if (outcome === 'APPROVED' && (proposal.baseline || proposal.target)) await refreshReconciliation(request.assignmentId);

  await auditAction(actor, {
    action: outcome === 'APPROVED' ? 'CHANGE_APPROVED' : 'CHANGE_REJECTED',
    entityType: 'assignment_change_request',
    entityId: request.id,
    oldValues: { status: request.status },
    newValues: { status: outcome, proposal },
    reason: reviewComment ?? undefined,
  });
  await changeReviewed(updated, actor);
  return updated;
};

export default { createChangeRequest, listChangeRequests, getChangeRequestById, reviewChangeRequest };
