import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { optionalString, parseDate, parseEnum, parseNumber, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { getSetting } from '../10-system-governance/system.service.js';
import {
  APPROVED_STATUSES,
  ASSIGNMENT_INCLUDE,
  LIVE_STATUSES,
  OPEN_CONTRACT_STATUSES,
  addVersion,
  assertAuthorityFromAbove,
  assertFrequencyFollowsAbove,
  assertSeparateApprover,
  assertWorksOnContract,
  assertYearReportsFrequency,
  canSeeAssignment,
  formatAssignment,
  getAssignmentOrThrow,
  isStaffContract,
  requireComment,
} from './contract.shared.js';
import { applyShareMethod, assertChildShare, loadShareContext, recordChildShare, releaseChildShare, resolveShareMethod, targetForShare } from './allocation.service.js';
import { parseBaseline, parseTarget, parseWeight, requiredImprovement } from './measurement.js';

/**
 * Module 05 — KPI assignments: a KPI on an office's contract, cascaded from the assignment above it.
 * It follows its contract: DRAFT while the office above builds it, SUBMITTED once assigned, ACKNOWLEDGED once the
 * receiving office signs, or REJECTED if that office flagged it. It can also be CANCELLED before assigning.
 * While in draft the baseline, target and weight are edited in place. After signing they change only through a
 * change request, which adds a new version.
 * On a staff contract a KPI comes from the office's own contract instead (its source), and its target is set by hand.
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

const parseScopeRelation = (value, kpi) => (value === undefined ? (kpi.isAdditive ? 'EXCLUSIVE_COMPLETE' : 'OVERLAPPING') : parseEnum(value, 'scopeRelation', SCOPE_RELATIONS));

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

/**
 * A staff contract takes its KPIs from the office's own signed contract of the same year: the source of each one.
 */
const assertSourceAssignment = async (contract, kpiId, sourceAssignmentId) => {
  if (!sourceAssignmentId) throw badRequest('parentAssignmentId is required: a staff contract takes its KPIs from the office\'s own contract');
  const source = await prisma.kpiAssignment.findUnique({ where: { id: sourceAssignmentId }, include: { contract: true } });
  if (!source) throw badRequest('The office\'s assignment was not found');
  if (source.kpiId !== kpiId) throw badRequest('The office\'s assignment is for a different KPI');
  if (source.contract.personId || source.contract.officeId !== contract.officeId || source.contract.fiscalYearId !== contract.fiscalYearId) {
    throw badRequest('A staff contract takes its KPIs from the contract of the office the person works in, in the same fiscal year');
  }
  if (!APPROVED_STATUSES.includes(source.status)) throw conflict('The office must sign this KPI on its own contract first');
  return source;
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
  if (!OPEN_CONTRACT_STATUSES.includes(contract.status)) throw conflict(`KPIs can be added only to a draft or rejected contract; this one is ${contract.status}`);

  const kpiId = parseUuid(data.kpiId, 'kpiId');
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId }, include: { scale: { include: { levels: true } } } });
  if (!kpi) throw badRequest('KPI not found');
  if (!kpi.isActive) throw badRequest(`"${kpi.name}" is retired`);

  const existing = await prisma.kpiAssignment.findUnique({ where: { contractId_kpiId: { contractId: contract.id, kpiId } } });
  if (existing && existing.status !== 'CANCELLED') throw conflict(`"${kpi.name}" is already on this contract`);

  // On a staff contract the KPI above is the office's own one, its source; nothing is shared from it
  const staff = isStaffContract(contract);
  const aboveId = parseUuid(data.parentAssignmentId, 'parentAssignmentId', { required: false }) ?? null;
  const source = staff ? await assertSourceAssignment(contract, kpiId, aboveId) : null;
  const parentAssignmentId = staff ? null : aboveId;
  const parent = staff ? source : await assertParentAssignment(contract, kpiId, parentAssignmentId);

  // Below the top office the frequency starts from the office above, and may only be more often
  const reportingFrequencyId = parseUuid(data.reportingFrequencyId, 'reportingFrequencyId', { required: false }) ?? parent?.reportingFrequencyId ?? kpi.defaultFrequencyId;
  await assertYearReportsFrequency(contract.fiscalYearId, reportingFrequencyId);
  await assertFrequencyFollowsAbove(parent?.reportingFrequencyId, reportingFrequencyId);

  const shareContext = parent && !staff ? await loadShareContext(parent.id) : null;
  const shareMethod = shareContext ? resolveShareMethod(shareContext, data.shareMethod) : null;
  const baseline = parseBaseline(kpi, data.baseline);
  const shared = shareContext && targetForShare(shareContext, shareMethod, kpi, baseline, contract.officeId);
  const target = parseTarget(kpi, shared ?? data.target);
  const weight = parseWeight(data.weight);
  const personId = actor.personId;
  const improvement = requiredImprovement(kpi, baseline, target);
  if (shareMethod === 'CUSTOM') await assertChildShare(parentAssignmentId, contract.officeId, improvement);
  const fields = {
    parentAssignmentId,
    sourceAssignmentId: source?.id ?? null,
    reportingFrequencyId,
    scopeRelation: parseScopeRelation(data.scopeRelation, kpi),
    maxOverAllocationPercent: parseNumber(data.maxOverAllocationPercent, 'maxOverAllocationPercent') ?? (await getSetting('kpi', 'default_max_over_allocation_percent')),
    createdByPersonId: personId,
  };

  // A cancelled KPI comes back on its own record: a contract holds a KPI once, and the old values stay as versions
  const assignment = existing
    ? await prisma.$transaction(async (tx) => {
        await addVersion(tx, tx.kpiBaseline, existing.id, { ...baseline, createdByPersonId: personId });
        await addVersion(tx, tx.kpiTarget, existing.id, { ...target, createdByPersonId: personId });
        await addVersion(tx, tx.kpiWeight, existing.id, { weight, createdByPersonId: personId });
        return tx.kpiAssignment.update({
          where: { id: existing.id },
          data: { ...fields, status: 'DRAFT', reviewComment: null, approvedByPersonId: null, approvedAt: null, acknowledgedByPersonId: null, acknowledgedAt: null },
          include: ASSIGNMENT_INCLUDE,
        });
      })
    : await prisma.kpiAssignment.create({
        data: {
          contractId: contract.id,
          kpiId,
          ...fields,
          baselines: { create: { ...baseline, createdByPersonId: personId } },
          targets: { create: { ...target, createdByPersonId: personId } },
          weights: { create: { weight, createdByPersonId: personId } },
        },
        include: ASSIGNMENT_INCLUDE,
      });
  if (shareContext) {
    await applyShareMethod(shareContext, shareMethod, personId, assignment.id);
    if (shareMethod !== 'FULL') await recordChildShare(parentAssignmentId, contract.officeId, assignment.id, improvement, personId);
  }
  await auditAction(actor, {
    action: 'ASSIGNMENT_CREATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    newValues: { contractId: contract.id, kpiId, parentAssignmentId, sourceAssignmentId: source?.id, reportingFrequencyId, shareMethod, baseline, target, weight },
  });
  return formatAssignment(assignment);
};

/**
 * Edit a draft or rejected assignment in place. A rejected one stays rejected until its contract is assigned again.
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
  const shareContext = assignment.parentAssignmentId ? await loadShareContext(assignment.parentAssignmentId) : null;
  if (data.reportingFrequencyId !== undefined) {
    update.reportingFrequencyId = parseUuid(data.reportingFrequencyId, 'reportingFrequencyId');
    await assertYearReportsFrequency(assignment.contract.fiscalYearId, update.reportingFrequencyId);
    const source = assignment.sourceAssignmentId ? await prisma.kpiAssignment.findUnique({ where: { id: assignment.sourceAssignmentId }, select: { reportingFrequencyId: true } }) : null;
    await assertFrequencyFollowsAbove(shareContext?.parent.reportingFrequencyId ?? source?.reportingFrequencyId, update.reportingFrequencyId);
  }
  if (data.scopeRelation !== undefined) update.scopeRelation = parseEnum(data.scopeRelation, 'scopeRelation', SCOPE_RELATIONS);
  if (data.maxOverAllocationPercent !== undefined) update.maxOverAllocationPercent = parseNumber(data.maxOverAllocationPercent, 'maxOverAllocationPercent') ?? null;

  const [before, targetBefore, weightBefore] = [assignment.baselines[0], assignment.targets[0], assignment.weights[0]];
  const shareMethod = shareContext ? resolveShareMethod(shareContext, data.shareMethod) : null;
  const baseline = data.baseline === undefined ? undefined : parseBaseline(assignment.kpi, data.baseline);
  // Shared equally or fully, the target follows the baseline and the share, so it is worked out again here
  const shared = shareContext && shareMethod !== 'CUSTOM' && (baseline || data.shareMethod !== undefined || data.target !== undefined) ? targetForShare(shareContext, shareMethod, assignment.kpi, baseline ?? before, assignment.contract.officeId) : null;
  const target = shared ? parseTarget(assignment.kpi, shared) : data.target === undefined ? undefined : parseTarget(assignment.kpi, data.target);
  const weight = data.weight === undefined ? undefined : parseWeight(data.weight);
  if (Object.keys(update).length === 0 && !baseline && !target && weight === undefined && data.shareMethod === undefined) throw badRequest('No updatable fields provided');

  const improvement = requiredImprovement(assignment.kpi, baseline ?? before, target ?? targetBefore);
  if (shareMethod === 'CUSTOM') await assertChildShare(assignment.parentAssignmentId, assignment.contract.officeId, improvement);
  const updated = await prisma.$transaction(async (tx) => {
    if (baseline) await tx.kpiBaseline.update({ where: { id: before.id }, data: { ...baseline, verifiedByPersonId: null, verifiedAt: null } });
    if (target) await tx.kpiTarget.update({ where: { id: targetBefore.id }, data: target });
    if (weight !== undefined) await tx.kpiWeight.update({ where: { id: weightBefore.id }, data: { weight } });
    return tx.kpiAssignment.update({ where: { id: assignment.id }, data: update, include: ASSIGNMENT_INCLUDE });
  });
  if (shareContext) {
    await applyShareMethod(shareContext, shareMethod, actor.personId, assignment.id);
    if (shareMethod !== 'FULL') await recordChildShare(assignment.parentAssignmentId, assignment.contract.officeId, assignment.id, improvement, actor.personId);
  }
  await auditAction(actor, {
    action: 'ASSIGNMENT_UPDATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { status: assignment.status, baseline: before, target: targetBefore, weight: weightBefore?.weight },
    newValues: { ...update, shareMethod, baseline, target, weight },
  });
  return formatAssignment(updated);
};

// ===== Workflow =====

/**
 * While reviewing a contract, the receiving office flags a KPI with a note for the office above, or clears the flag
 * with no note. Notes stay until the contract is assigned again.
 */
export const flagAssignment = async (id, { note } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertWorksOnContract(actor, PERMISSIONS.CONTRACT_ACKNOWLEDGE, assignment.contract);
  if (assignment.contract.status !== 'SUBMITTED' || assignment.status !== 'SUBMITTED') throw conflict('KPIs can be flagged only while their contract is waiting for a signature');

  const reviewComment = note === null || note === undefined ? null : requireComment(note);
  const updated = await prisma.kpiAssignment.update({ where: { id: assignment.id }, data: { reviewComment }, include: ASSIGNMENT_INCLUDE });
  await auditAction(actor, { action: reviewComment ? 'ASSIGNMENT_FLAGGED' : 'ASSIGNMENT_UNFLAGGED', entityType: 'kpi_assignment', entityId: assignment.id, oldValues: { reviewComment: assignment.reviewComment }, newValues: { reviewComment } });
  return formatAssignment(updated);
};

/**
 * Cancel an assignment that nothing depends on yet. Approved ones stay part of the record.
 */
export const cancelAssignment = async (id, { comment } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertEditableYear(assignment);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract);
  if (!['DRAFT', 'REJECTED'].includes(assignment.status)) throw conflict(`A ${assignment.status} assignment cannot be cancelled`);
  const children = await prisma.kpiAssignment.count({ where: { parentAssignmentId: assignment.id, status: { in: LIVE_STATUSES } } });
  if (children > 0) throw conflict('This assignment has cascaded assignments below it');
  const reason = requireComment(comment);
  const cancelled = await setStatus(assignment, 'CANCELLED', { reviewComment: reason }, actor, 'ASSIGNMENT_CANCELLED', reason);
  await releaseChildShare(assignment.parentAssignmentId, assignment.contract.officeId);
  return cancelled;
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
  flagAssignment,
  cancelAssignment,
  verifyBaseline,
  addBaselineEvidence,
};
