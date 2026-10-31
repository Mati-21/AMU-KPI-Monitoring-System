import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { optionalString, parseDate, parseEnum, parseNumber, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { assignmentApproved, assignmentRejected, assignmentSubmitted } from '../09-notifications/notification.events.js';
import { getSetting } from '../10-system-governance/system.service.js';
import {
  APPROVED_STATUSES,
  ASSIGNMENT_INCLUDE,
  LIVE_STATUSES,
  assertAuthorityFromAbove,
  assertAuthorityOnOffice,
  assertSeparateApprover,
  canSeeAssignment,
  formatAssignment,
  getAssignmentOrThrow,
  requireComment,
} from './contract.shared.js';
import { parseBaseline, parseTarget, parseWeight } from './measurement.js';

/**
 * Module 05 — KPI assignments: a KPI on an office's contract, cascaded from the assignment above it.
 * Workflow: DRAFT -> SUBMITTED -> APPROVED -> ACKNOWLEDGED, or REJECTED (editable again) or CANCELLED.
 * While in draft the baseline, target and weight are edited in place. After approval they change only through a
 * change request, which adds a new version.
 */

const SCOPE_RELATIONS = ['EXCLUSIVE_COMPLETE', 'OVERLAPPING', 'INSTITUTION_WIDE'];

const assertEditableYear = (assignment) => assertFiscalYearOpen(assignment.contract.fiscalYearId);

const audit = (actor, assignment, action, status, reason) =>
  auditAction(actor, {
    action,
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { status: assignment.status },
    newValues: { status },
    reason,
  });

const setStatus = async (assignment, status, data, actor, action, reason) => {
  const updated = await prisma.kpiAssignment.update({ where: { id: assignment.id }, data: { status, ...data }, include: ASSIGNMENT_INCLUDE });
  await audit(actor, assignment, action, status, reason);
  return formatAssignment(updated);
};

const assertStatus = (assignment, expected) => {
  if (assignment.status !== expected) throw conflict(`This action needs a ${expected} assignment; this one is ${assignment.status}`);
};

const parseScopeRelation = (value, kpi) => (value === undefined ? (kpi.isAdditive ? 'EXCLUSIVE_COMPLETE' : 'OVERLAPPING') : parseEnum(value, 'scopeRelation', SCOPE_RELATIONS));

const assertFrequency = async (frequencyId) => {
  if (!(await prisma.reportingFrequency.findUnique({ where: { id: frequencyId }, select: { id: true } }))) throw badRequest('Reporting frequency not found');
};

/**
 * Cascading rules: the top office starts a KPI's chain. Every other office receives it from an approved assignment
 * of the same KPI, in the same year, on the contract of the office directly above.
 */
const assertParentAssignment = async (contract, kpiId, parentAssignmentId) => {
  if (!contract.assigningOfficeId) {
    if (parentAssignmentId) throw badRequest('The top office has no assignment above it');
    return null;
  }
  if (!parentAssignmentId) throw badRequest('parentAssignmentId is required: a KPI cascades from the office above');

  const parent = await prisma.kpiAssignment.findUnique({ where: { id: parentAssignmentId }, include: { contract: true } });
  if (!parent) throw badRequest('Parent assignment not found');
  if (parent.kpiId !== kpiId) throw badRequest('The parent assignment is for a different KPI');
  if (parent.contract.officeId !== contract.assigningOfficeId || parent.contract.fiscalYearId !== contract.fiscalYearId) {
    throw badRequest('The parent assignment must be on the contract of the office directly above, in the same fiscal year');
  }
  if (!APPROVED_STATUSES.includes(parent.status)) throw conflict('The parent assignment must be approved before it can cascade');
  return parent;
};

// ===== Queries =====

/**
 * One assignment with its full history: every baseline, target and weight version (SRS 4.6).
 */
export const getAssignmentById = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  if (!(await canSeeAssignment(actor, assignment.contract, assignment.status))) throw notFound('Assignment not found');

  const [baselines, targets, weights, parent] = await Promise.all([
    prisma.kpiBaseline.findMany({ where: { assignmentId: assignment.id }, orderBy: { versionNo: 'desc' } }),
    prisma.kpiTarget.findMany({ where: { assignmentId: assignment.id }, orderBy: { versionNo: 'desc' } }),
    prisma.kpiWeight.findMany({ where: { assignmentId: assignment.id }, orderBy: { versionNo: 'desc' } }),
    assignment.parentAssignmentId
      ? prisma.kpiAssignment.findUnique({ where: { id: assignment.parentAssignmentId }, select: { id: true, status: true, contract: { select: { office: { select: { id: true, name: true } } } } } })
      : null,
  ]);
  return { ...formatAssignment(assignment), parent, history: { baselines, targets, weights } };
};

/**
 * The cascade of one KPI in one year as a tree. Assignments the actor may not see are left out.
 */
export const getAssignmentTree = async ({ fiscalYearId, kpiId } = {}, actor) => {
  const assignments = await prisma.kpiAssignment.findMany({
    where: { kpiId: parseUuid(kpiId, 'kpiId'), contract: { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') }, status: { not: 'CANCELLED' } },
    include: ASSIGNMENT_INCLUDE,
  });

  const nodes = new Map();
  for (const assignment of assignments) {
    if (await canSeeAssignment(actor, assignment.contract, assignment.status)) nodes.set(assignment.id, { ...formatAssignment(assignment), children: [] });
  }
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.parentAssignmentId && nodes.get(node.parentAssignmentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
};

// ===== Create and edit =====

/**
 * Assign a KPI on a draft contract. The assigning office sets the official baseline, target and weight (SRS 4.3).
 */
export const createAssignment = async (contractId, data = {}, actor) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(contractId, 'contractId') } });
  if (!contract) throw notFound('Contract not found');
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, contract);
  if (contract.status !== 'DRAFT') throw conflict(`KPIs can be added only to a draft contract; this one is ${contract.status}`);

  const kpiId = parseUuid(data.kpiId, 'kpiId');
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId }, include: { scale: { include: { levels: true } } } });
  if (!kpi) throw badRequest('KPI not found');
  if (!kpi.isActive) throw badRequest(`KPI ${kpi.code} is retired`);

  const existing = await prisma.kpiAssignment.findUnique({ where: { contractId_kpiId: { contractId: contract.id, kpiId } } });
  if (existing) throw conflict(`KPI ${kpi.code} is already on this contract`);

  const parentAssignmentId = parseUuid(data.parentAssignmentId, 'parentAssignmentId', { required: false }) ?? null;
  await assertParentAssignment(contract, kpiId, parentAssignmentId);

  const reportingFrequencyId = parseUuid(data.reportingFrequencyId, 'reportingFrequencyId', { required: false }) ?? kpi.defaultFrequencyId;
  await assertFrequency(reportingFrequencyId);

  const baseline = parseBaseline(kpi, data.baseline);
  const target = parseTarget(kpi, data.target);
  const weight = parseWeight(data.weight);
  const personId = actor.personId;

  const assignment = await prisma.kpiAssignment.create({
    data: {
      contractId: contract.id,
      kpiId,
      parentAssignmentId,
      reportingFrequencyId,
      scopeRelation: parseScopeRelation(data.scopeRelation, kpi),
      maxOverAllocationPercent: parseNumber(data.maxOverAllocationPercent, 'maxOverAllocationPercent') ?? (await getSetting('kpi', 'default_max_over_allocation_percent')),
      createdByPersonId: personId,
      baselines: { create: { ...baseline, createdByPersonId: personId } },
      targets: { create: { ...target, createdByPersonId: personId } },
      weights: { create: { weight, createdByPersonId: personId } },
    },
    include: ASSIGNMENT_INCLUDE,
  });
  await auditAction(actor, {
    action: 'ASSIGNMENT_CREATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    newValues: { contractId: contract.id, kpiId, parentAssignmentId, reportingFrequencyId, baseline, target, weight },
  });
  return formatAssignment(assignment);
};

/**
 * Edit a draft or rejected assignment in place. Saving a rejected one returns it to draft.
 * The baseline goes back to unverified when it changes.
 */
export const updateAssignment = async (id, data = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract);
  if (!['DRAFT', 'REJECTED'].includes(assignment.status)) {
    throw conflict(`A ${assignment.status} assignment cannot be edited. Submit a change request instead`);
  }

  const update = {};
  if (data.reportingFrequencyId !== undefined) {
    update.reportingFrequencyId = parseUuid(data.reportingFrequencyId, 'reportingFrequencyId');
    await assertFrequency(update.reportingFrequencyId);
  }
  if (data.scopeRelation !== undefined) update.scopeRelation = parseEnum(data.scopeRelation, 'scopeRelation', SCOPE_RELATIONS);
  if (data.maxOverAllocationPercent !== undefined) update.maxOverAllocationPercent = parseNumber(data.maxOverAllocationPercent, 'maxOverAllocationPercent') ?? null;

  const baseline = data.baseline === undefined ? undefined : parseBaseline(assignment.kpi, data.baseline);
  const target = data.target === undefined ? undefined : parseTarget(assignment.kpi, data.target);
  const weight = data.weight === undefined ? undefined : parseWeight(data.weight);
  if (Object.keys(update).length === 0 && !baseline && !target && weight === undefined) throw badRequest('No updatable fields provided');

  const [before, targetBefore, weightBefore] = [assignment.baselines[0], assignment.targets[0], assignment.weights[0]];
  const updated = await prisma.$transaction(async (tx) => {
    if (baseline) await tx.kpiBaseline.update({ where: { id: before.id }, data: { ...baseline, verifiedByPersonId: null, verifiedAt: null } });
    if (target) await tx.kpiTarget.update({ where: { id: targetBefore.id }, data: target });
    if (weight !== undefined) await tx.kpiWeight.update({ where: { id: weightBefore.id }, data: { weight } });
    return tx.kpiAssignment.update({ where: { id: assignment.id }, data: { ...update, status: 'DRAFT', reviewComment: null }, include: ASSIGNMENT_INCLUDE });
  });
  await auditAction(actor, {
    action: 'ASSIGNMENT_UPDATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { status: assignment.status, baseline: before, target: targetBefore, weight: weightBefore?.weight },
    newValues: { ...update, baseline, target, weight },
  });
  return formatAssignment(updated);
};

// ===== Workflow =====

export const submitAssignment = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract);
  assertStatus(assignment, 'DRAFT');
  const submitted = await setStatus(assignment, 'SUBMITTED', {}, actor, 'ASSIGNMENT_SUBMITTED');
  await assignmentSubmitted(assignment, actor);
  return submitted;
};

/**
 * Approving also approves the current target and weight. A pending baseline blocks approval, and so does an
 * unverified one when the university requires verification (SRS 5.5). A declared unknown baseline may pass (SRS 5.6).
 */
export const approveAssignment = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, assignment.contract);
  assertStatus(assignment, 'SUBMITTED');
  await assertSeparateApprover(actor, assignment.createdByPersonId);

  const baseline = assignment.baselines[0];
  if (baseline.baselineStatus === 'PENDING_VERIFICATION') throw conflict('The baseline is pending verification');
  if (baseline.baselineStatus === 'KNOWN' && (await getSetting('kpi', 'require_baseline_verification'))) {
    throw conflict('The baseline must be verified before approval');
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.kpiTarget.update({ where: { id: assignment.targets[0].id }, data: { approvedByPersonId: actor.personId, approvedAt: now } });
    await tx.kpiWeight.update({ where: { id: assignment.weights[0].id }, data: { approvedByPersonId: actor.personId, approvedAt: now } });
    return tx.kpiAssignment.update({ where: { id: assignment.id }, data: { status: 'APPROVED', approvedByPersonId: actor.personId, approvedAt: now, reviewComment: null }, include: ASSIGNMENT_INCLUDE });
  });
  await audit(actor, assignment, 'ASSIGNMENT_APPROVED', 'APPROVED');
  await assignmentApproved(assignment, actor);
  return formatAssignment(updated);
};

export const rejectAssignment = async (id, { comment } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, assignment.contract);
  assertStatus(assignment, 'SUBMITTED');
  const reason = requireComment(comment);
  const rejected = await setStatus(assignment, 'REJECTED', { reviewComment: reason }, actor, 'ASSIGNMENT_REJECTED', reason);
  await assignmentRejected(assignment, reason, actor);
  return rejected;
};

export const acknowledgeAssignment = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_ACKNOWLEDGE, assignment.contract.officeId);
  assertStatus(assignment, 'APPROVED');
  return setStatus(assignment, 'ACKNOWLEDGED', { acknowledgedByPersonId: actor.personId, acknowledgedAt: new Date() }, actor, 'ASSIGNMENT_ACKNOWLEDGED');
};

/**
 * Cancel an assignment that nothing depends on yet. Approved ones stay part of the record.
 */
export const cancelAssignment = async (id, { comment } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract);
  if (!['DRAFT', 'SUBMITTED', 'REJECTED'].includes(assignment.status)) throw conflict(`A ${assignment.status} assignment cannot be cancelled`);
  const children = await prisma.kpiAssignment.count({ where: { parentAssignmentId: assignment.id, status: { in: LIVE_STATUSES } } });
  if (children > 0) throw conflict('This assignment has cascaded assignments below it');
  const reason = requireComment(comment);
  return setStatus(assignment, 'CANCELLED', { reviewComment: reason }, actor, 'ASSIGNMENT_CANCELLED', reason);
};

// ===== Baseline verification and evidence =====

export const verifyBaseline = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, assignment.contract);
  await assertSeparateApprover(actor, assignment.createdByPersonId);

  const baseline = assignment.baselines[0];
  if (!['KNOWN', 'PENDING_VERIFICATION'].includes(baseline.baselineStatus)) throw conflict(`A ${baseline.baselineStatus} baseline cannot be verified`);
  if (baseline.value === null && baseline.scaleLevelId === null) throw conflict('Enter the baseline value before verifying it');

  await prisma.kpiBaseline.update({ where: { id: baseline.id }, data: { baselineStatus: 'VERIFIED', verifiedByPersonId: actor.personId, verifiedAt: new Date() } });
  await auditAction(actor, {
    action: 'BASELINE_VERIFIED',
    entityType: 'kpi_baseline',
    entityId: baseline.id,
    oldValues: { baselineStatus: baseline.baselineStatus },
    newValues: { baselineStatus: 'VERIFIED' },
  });
  return formatAssignment(await getAssignmentOrThrow(id));
};

/**
 * Attach a document to the current baseline, with its source and date (SRS 5.5).
 */
export const addBaselineEvidence = async (id, { documentId, sourceDescription, sourceDate } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract);

  const docId = parseUuid(documentId, 'documentId');
  if (!(await prisma.document.findUnique({ where: { id: docId }, select: { id: true } }))) throw badRequest('Document not found');

  const evidence = await prisma.baselineEvidence.create({
    data: {
      baselineId: assignment.baselines[0].id,
      documentId: docId,
      sourceDescription: optionalString(sourceDescription, 'sourceDescription') ?? null,
      sourceDate: parseDate(sourceDate, 'sourceDate', { required: false }),
    },
  });
  await auditAction(actor, { action: 'BASELINE_EVIDENCE_ADDED', entityType: 'baseline_evidence', entityId: evidence.id, newValues: evidence });
  return evidence;
};

export default {
  getAssignmentById,
  getAssignmentTree,
  createAssignment,
  updateAssignment,
  submitAssignment,
  approveAssignment,
  rejectAssignment,
  acknowledgeAssignment,
  cancelAssignment,
  verifyBaseline,
  addBaselineEvidence,
};
