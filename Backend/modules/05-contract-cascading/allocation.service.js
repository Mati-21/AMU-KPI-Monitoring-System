import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { optionalString, parseEnum, parseNumber, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { APPROVED_STATUSES, assertAuthorityOnOffice, canSeeAssignment, getAssignmentOrThrow, requireComment } from './contract.shared.js';
import { requiredImprovement, toNumber } from './measurement.js';

/**
 * Module 05 — Responsibility: how much of its assigned improvement an office distributes and how much it keeps.
 * Parent responsibility = distributed + retained, checked only for additive KPIs with exclusive, complete scopes
 * (SRS 4.5). A difference is flagged, never fixed automatically: the office corrects it or justifies it.
 */

const DISTRIBUTION_METHODS = ['EQUAL', 'CUSTOM', 'FULL', 'NONE'];
const round4 = (value) => Math.round(value * 10000) / 10000;

const parentAmountOf = (assignment) => requiredImprovement(assignment.kpi, assignment.baselines[0], assignment.targets[0]);

const needsReconciliation = (assignment) => assignment.kpi.isAdditive && assignment.scopeRelation === 'EXCLUSIVE_COMPLETE';

const statusFor = (assignment, parentAmount, total) => {
  if (!needsReconciliation(assignment) || parentAmount === null) return 'NOT_REQUIRED';
  const difference = round4(total - parentAmount);
  if (difference === 0) return 'BALANCED';
  return difference > 0 ? 'OVER_ALLOCATED' : 'UNDER_ALLOCATED';
};

const sumAllocations = (rows) => {
  const distributed = round4(rows.filter((row) => row.allocationType === 'DISTRIBUTED').reduce((sum, row) => sum + toNumber(row.allocatedAmount), 0));
  const retained = round4(rows.filter((row) => row.allocationType === 'RETAINED').reduce((sum, row) => sum + toNumber(row.allocatedAmount), 0));
  return { distributed, retained };
};

const summarize = (assignment, rows) => {
  const parentAmount = parentAmountOf(assignment);
  const { distributed, retained } = sumAllocations(rows);
  return {
    assignmentId: assignment.id,
    distributionMethod: assignment.distributionMethod,
    scopeRelation: assignment.scopeRelation,
    reconciliationStatus: assignment.reconciliationStatus,
    reconciliationNote: assignment.reconciliationNote,
    parentAmount,
    distributed,
    retained,
    unallocated: parentAmount === null ? null : round4(parentAmount - distributed - retained),
    allocations: rows,
  };
};

const ALLOCATION_INCLUDE = {
  childAssignment: { select: { id: true, status: true, contract: { select: { office: { select: { id: true, name: true, code: true } } } } } },
};

const loadRows = (assignmentId) => prisma.responsibilityAllocation.findMany({ where: { parentAssignmentId: assignmentId }, include: ALLOCATION_INCLUDE, orderBy: { createdAt: 'asc' } });

export const getAllocations = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  if (!(await canSeeAssignment(actor, assignment.contract, assignment.status))) throw notFound('Assignment not found');
  return summarize(assignment, await loadRows(assignment.id));
};

/**
 * Work out each child's amount from the chosen method.
 */
const resolveAmounts = (method, parentAmount, children, retainedInput) => {
  if (method === 'NONE') {
    if (children.length > 0) throw badRequest('Method NONE keeps all responsibility, so it lists no offices');
    if (parentAmount === null && retainedInput === undefined) throw badRequest('retainedAmount is required while the assigned improvement cannot be calculated');
    return { retained: retainedInput ?? parentAmount, amounts: [] };
  }
  if (children.length === 0) throw badRequest(`Method ${method} needs at least one office in allocations`);
  if (method === 'FULL' && retainedInput) throw badRequest('Method FULL distributes everything, so retainedAmount must be 0');
  const retained = retainedInput ?? 0;

  if (method === 'EQUAL') {
    if (parentAmount === null) throw badRequest('Method EQUAL needs an assigned improvement that can be calculated');
    const share = round4((parentAmount - retained) / children.length);
    return { retained, amounts: children.map(() => share) };
  }
  return { retained, amounts: children.map((child) => child.amount) };
};

/**
 * Record the whole split at once, replacing the previous one.
 * Over-allocation beyond the assignment's cap is refused; anything within it is saved and flagged.
 */
export const saveAllocations = async (id, data = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertFiscalYearOpen(assignment.contract.fiscalYearId);
  // Distributing is the receiving office's own decision (SRS 4.4)
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract.officeId);
  if (!APPROVED_STATUSES.includes(assignment.status)) throw conflict('Responsibility can be distributed only from an approved assignment');

  const method = parseEnum(data.distributionMethod, 'distributionMethod', DISTRIBUTION_METHODS);
  const retainedInput = parseNumber(data.retainedAmount, 'retainedAmount');
  if (retainedInput !== undefined && retainedInput < 0) throw badRequest('retainedAmount cannot be negative');

  const items = data.allocations ?? [];
  if (!Array.isArray(items)) throw badRequest('allocations must be a list');
  const childIds = items.map((item, index) => parseUuid(item?.childAssignmentId, `allocations[${index}].childAssignmentId`));
  if (new Set(childIds).size !== childIds.length) throw badRequest('An office can appear only once in allocations');

  const found = await prisma.kpiAssignment.findMany({
    where: { id: { in: childIds }, parentAssignmentId: assignment.id, status: { notIn: ['CANCELLED', 'REJECTED'] } },
    include: { kpi: { include: { scale: { include: { levels: true } } } }, baselines: { where: { isCurrent: true }, take: 1 }, targets: { where: { isCurrent: true }, take: 1 } },
  });
  const byId = new Map(found.map((child) => [child.id, child]));
  const children = items.map((item, index) => {
    const child = byId.get(childIds[index]);
    if (!child) throw badRequest(`allocations[${index}] is not a live assignment cascaded from this one`);
    const given = parseNumber(item.amount, `allocations[${index}].amount`);
    if (given !== undefined && given < 0) throw badRequest(`allocations[${index}].amount cannot be negative`);
    // Without an explicit amount, an office's share is the improvement assigned to it
    const amount = given ?? requiredImprovement(child.kpi, child.baselines[0], child.targets[0]);
    if (method !== 'EQUAL' && amount === null) throw badRequest(`allocations[${index}].amount is required: this office's improvement cannot be calculated`);
    return { id: child.id, amount, note: optionalString(item.note, `allocations[${index}].note`) ?? null };
  });

  const parentAmount = parentAmountOf(assignment);
  const { retained, amounts } = resolveAmounts(method, parentAmount, children, retainedInput);
  const total = round4(amounts.reduce((sum, amount) => sum + amount, 0) + retained);

  const cap = toNumber(assignment.maxOverAllocationPercent);
  if (needsReconciliation(assignment) && parentAmount !== null && cap !== null && total > round4(parentAmount * (1 + cap / 100))) {
    throw badRequest(`Distributed and retained total ${total}, more than the ${cap}% over-allocation allowed on ${parentAmount}`);
  }

  const reconciliationStatus = statusFor(assignment, parentAmount, total);
  const personId = actor.personId;
  await prisma.$transaction(async (tx) => {
    await tx.responsibilityAllocation.deleteMany({ where: { parentAssignmentId: assignment.id } });
    await tx.responsibilityAllocation.createMany({
      data: [
        ...children.map((child, index) => ({
          parentAssignmentId: assignment.id,
          childAssignmentId: child.id,
          allocationType: 'DISTRIBUTED',
          allocatedAmount: amounts[index],
          note: child.note,
          createdByPersonId: personId,
        })),
        ...(retained > 0 || method === 'NONE'
          ? [{ parentAssignmentId: assignment.id, childAssignmentId: null, allocationType: 'RETAINED', allocatedAmount: retained, note: optionalString(data.retainedNote, 'retainedNote') ?? null, createdByPersonId: personId }]
          : []),
      ],
    });
    await tx.kpiAssignment.update({ where: { id: assignment.id }, data: { distributionMethod: method, reconciliationStatus, reconciliationNote: null } });
  });
  await auditAction(actor, {
    action: 'RESPONSIBILITY_ALLOCATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { reconciliationStatus: assignment.reconciliationStatus },
    newValues: { method, retained, distributed: children.map((child, index) => ({ childAssignmentId: child.id, amount: amounts[index] })), reconciliationStatus },
  });
  return summarize(await getAssignmentOrThrow(id), await loadRows(assignment.id));
};

/**
 * Formally justify a difference that stays (SRS 4.5).
 */
export const justifyReconciliation = async (id, { note } = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertFiscalYearOpen(assignment.contract.fiscalYearId);
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract.officeId);
  if (!['UNDER_ALLOCATED', 'OVER_ALLOCATED'].includes(assignment.reconciliationStatus)) throw conflict('Only an unbalanced split can be justified');
  const reason = requireComment(note);

  await prisma.kpiAssignment.update({ where: { id: assignment.id }, data: { reconciliationStatus: 'JUSTIFIED', reconciliationNote: reason } });
  await auditAction(actor, {
    action: 'RECONCILIATION_JUSTIFIED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { reconciliationStatus: assignment.reconciliationStatus },
    newValues: { reconciliationStatus: 'JUSTIFIED' },
    reason,
  });
  return summarize(await getAssignmentOrThrow(id), await loadRows(assignment.id));
};

/**
 * Recheck the split after an approved change to this assignment's baseline or target.
 */
export const refreshReconciliation = async (id) => {
  const assignment = await getAssignmentOrThrow(id);
  const rows = await loadRows(assignment.id);
  if (rows.length === 0) return;
  const { distributed, retained } = sumAllocations(rows);
  const reconciliationStatus = statusFor(assignment, parentAmountOf(assignment), round4(distributed + retained));
  if (reconciliationStatus !== assignment.reconciliationStatus) {
    await prisma.kpiAssignment.update({ where: { id: assignment.id }, data: { reconciliationStatus, reconciliationNote: null } });
  }
};

export default { getAllocations, saveAllocations, justifyReconciliation, refreshReconciliation };
