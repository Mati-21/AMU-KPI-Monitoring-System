import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { parseEnum, parseNumber, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { APPROVED_STATUSES, OPEN_CONTRACT_STATUSES, assertAuthorityOnOffice, canSeeAssignment, getAssignmentOrThrow, requireComment } from './contract.shared.js';
import { numericValue, requiredImprovement, toNumber } from './measurement.js';

/**
 * Module 05 — Sharing: how an office shares the improvement of a KPI between the offices below it.
 * What is shared and what it keeps must reach at least the improvement. Giving more is allowed, as a safety margin.
 * A share belongs to an office, so it can be set before that office has a contract. Rates cannot be split.
 */

const SHARE_METHODS = ['EQUAL', 'CUSTOM'];
const SPLITTABLE_TYPES = ['NUMBER', 'MONEY'];
const OFFICE_REF = { select: { id: true, name: true, code: true } };
const current = { where: { isCurrent: true }, take: 1 };
const round4 = (value) => Math.round(value * 10000) / 10000;

const parentAmountOf = (assignment) => requiredImprovement(assignment.kpi, assignment.baselines[0], assignment.targets[0]);

const isShareable = (assignment, parentAmount) => SPLITTABLE_TYPES.includes(assignment.kpi.measurementType) && assignment.kpi.isAdditive && assignment.scopeRelation === 'EXCLUSIVE_COMPLETE' && parentAmount > 0;

const statusFor = (shareable, parentAmount, total) => {
  if (!shareable || total === 0) return 'NOT_REQUIRED';
  const difference = round4(total - parentAmount);
  if (difference === 0) return 'BALANCED';
  return difference > 0 ? 'OVER_ALLOCATED' : 'UNDER_ALLOCATED';
};

/**
 * One office's line: its saved share, or for a KPI given before sharing was set, the improvement it was given.
 */
const officeLine = (office, row, child) => ({
  office,
  amount: row ? toNumber(row.allocatedAmount) : child ? requiredImprovement(child.kpi, child.baselines[0], child.targets[0]) : null,
  assignmentId: child?.id ?? null,
  status: child?.status ?? null,
  locked: Boolean(child) && !OPEN_CONTRACT_STATUSES.includes(child.status),
});

const describeSharing = (assignment, rows, children) => {
  const parentAmount = parentAmountOf(assignment);
  if (!isShareable(assignment, parentAmount)) return { shareable: false, offices: [] };

  const shares = rows.filter((row) => row.allocationType === 'DISTRIBUTED');
  const officeIds = new Set([...shares.map((row) => row.childOfficeId), ...children.map((child) => child.contract.office.id)]);
  const offices = [...officeIds]
    .map((id) => {
      const row = shares.find((candidate) => candidate.childOfficeId === id);
      const child = children.find((candidate) => candidate.contract.office.id === id);
      return officeLine(row?.childOffice ?? child.contract.office, row, child);
    })
    .sort((a, b) => a.office.name.localeCompare(b.office.name));

  const distributed = round4(offices.reduce((sum, line) => sum + (line.amount ?? 0), 0));
  const retained = toNumber(rows.find((row) => row.allocationType === 'RETAINED')?.allocatedAmount) ?? 0;
  const assigned = round4(distributed + retained);
  return { shareable: true, parentAmount, distributed, retained, assigned, difference: round4(assigned - parentAmount), offices };
};

/**
 * The sharing of many assignments, by assignment id.
 */
export const loadSharing = async (assignments) => {
  const ids = assignments.map((assignment) => assignment.id);
  const [rows, children] = await Promise.all([
    prisma.responsibilityAllocation.findMany({ where: { parentAssignmentId: { in: ids } }, include: { childOffice: OFFICE_REF } }),
    prisma.kpiAssignment.findMany({
      where: { parentAssignmentId: { in: ids }, status: { not: 'CANCELLED' } },
      include: { kpi: { include: { scale: { include: { levels: true } } } }, baselines: current, targets: current, contract: { select: { office: OFFICE_REF } } },
    }),
  ]);
  return new Map(
    assignments.map((assignment) => [
      assignment.id,
      describeSharing(
        assignment,
        rows.filter((row) => row.parentAssignmentId === assignment.id),
        children.filter((child) => child.parentAssignmentId === assignment.id)
      ),
    ])
  );
};

const sharingOf = async (assignment) => (await loadSharing([assignment])).get(assignment.id);

/**
 * The sharing of one KPI, with every office below that could receive a share.
 */
export const getAllocations = async (id, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  if (!(await canSeeAssignment(actor, assignment.contract, assignment.status))) throw notFound('Assignment not found');
  const sharing = await sharingOf(assignment);
  if (!sharing.shareable) return sharing;

  const below = await prisma.office.findMany({ where: { parentOfficeId: assignment.contract.officeId, isActive: true }, ...OFFICE_REF, orderBy: { name: 'asc' } });
  return { ...sharing, candidates: below.filter((office) => !sharing.offices.some((line) => line.office.id === office.id)) };
};

const targetFromShare = (child, amount) => {
  const start = numericValue(child.kpi, child.baselines[0]);
  if (start === null || ['UNKNOWN', 'PENDING_VERIFICATION'].includes(child.baselines[0].baselineStatus)) return null;
  const value = round4(child.kpi.direction === 'LOWER_IS_BETTER' ? start - amount : start + amount);
  if (value < 0) throw badRequest(`${child.contract.office.name} starts from ${start}, so it cannot reduce by ${amount}`);
  return value;
};

/**
 * Save the whole split at once, replacing the previous one. A KPI still in draft takes its new target from its share.
 * A KPI the office below already has cannot change here, and an office holding the KPI cannot be left out.
 */
export const saveAllocations = async (id, data = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertFiscalYearOpen(assignment.contract.fiscalYearId);
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract.officeId);
  if (!APPROVED_STATUSES.includes(assignment.status)) throw conflict('A KPI can be shared only after its contract is signed');

  const sharing = await sharingOf(assignment);
  if (!sharing.shareable) throw conflict('This KPI cannot be split: every office works towards the same target');

  const method = parseEnum(data.distributionMethod, 'distributionMethod', SHARE_METHODS);
  const retained = parseNumber(data.retainedAmount, 'retainedAmount') ?? 0;
  if (retained < 0) throw badRequest('retainedAmount cannot be negative');

  if (!Array.isArray(data.shares)) throw badRequest('shares must be a list');
  const shares = data.shares.map((item, index) => {
    const amount = parseNumber(item?.amount, `shares[${index}].amount`, { required: true });
    if (amount <= 0) throw badRequest(`shares[${index}].amount must be above 0`);
    return { officeId: parseUuid(item.officeId, `shares[${index}].officeId`), amount };
  });
  const givenIds = shares.map((share) => share.officeId);
  if (new Set(givenIds).size !== givenIds.length) throw badRequest('An office can appear only once in shares');

  const below = await prisma.office.findMany({ where: { parentOfficeId: assignment.contract.officeId, isActive: true }, select: { id: true } });
  const allowed = new Set([...below.map((office) => office.id), ...sharing.offices.map((line) => line.office.id)]);
  if (givenIds.some((officeId) => !allowed.has(officeId))) throw badRequest('A share can go only to an active office directly below');

  for (const line of sharing.offices) {
    const share = shares.find((candidate) => candidate.officeId === line.office.id);
    if (line.locked && line.amount !== null && share?.amount !== line.amount) throw conflict(`${line.office.name} already has this KPI, so its share of ${line.amount} cannot change`);
    if (line.assignmentId && !share && !(line.locked && line.amount === null)) throw conflict(`${line.office.name} has this KPI on its contract. Cancel it there first`);
  }

  const total = round4(shares.reduce((sum, share) => sum + share.amount, retained));
  if (total < sharing.parentAmount) throw badRequest(`Short by ${round4(sharing.parentAmount - total)}: at least ${sharing.parentAmount} must be assigned`);

  const children = await prisma.kpiAssignment.findMany({
    where: { parentAssignmentId: assignment.id, status: { in: ['DRAFT', 'REJECTED'] } },
    include: { kpi: { include: { scale: { include: { levels: true } } } }, baselines: current, targets: current, contract: { select: { office: OFFICE_REF } } },
  });
  const newTargets = children.flatMap((child) => {
    const share = shares.find((candidate) => candidate.officeId === child.contract.office.id);
    const value = share && targetFromShare(child, share.amount);
    return value === null || value === undefined ? [] : [{ id: child.targets[0].id, value }];
  });

  const lines = new Map(sharing.offices.map((line) => [line.office.id, line]));
  const personId = actor.personId;
  await prisma.$transaction(async (tx) => {
    await tx.responsibilityAllocation.deleteMany({ where: { parentAssignmentId: assignment.id } });
    await tx.responsibilityAllocation.createMany({
      data: [
        ...shares.map((share) => ({ parentAssignmentId: assignment.id, childOfficeId: share.officeId, childAssignmentId: lines.get(share.officeId)?.assignmentId ?? null, allocationType: 'DISTRIBUTED', allocatedAmount: share.amount, createdByPersonId: personId })),
        ...(retained > 0 ? [{ parentAssignmentId: assignment.id, allocationType: 'RETAINED', allocatedAmount: retained, createdByPersonId: personId }] : []),
      ],
    });
    for (const target of newTargets) await tx.kpiTarget.update({ where: { id: target.id }, data: { value: target.value } });
    await tx.kpiAssignment.update({ where: { id: assignment.id }, data: { distributionMethod: shares.length > 0 ? method : 'NONE', reconciliationStatus: statusFor(true, sharing.parentAmount, total), reconciliationNote: null } });
  });
  await auditAction(actor, {
    action: 'RESPONSIBILITY_ALLOCATED',
    entityType: 'kpi_assignment',
    entityId: assignment.id,
    oldValues: { retained: sharing.retained, shares: sharing.offices.map((line) => ({ officeId: line.office.id, amount: line.amount })) },
    newValues: { method, retained, shares },
  });
  return sharingOf(assignment);
};

/**
 * A KPI saved directly on an office's contract cannot take a fully assigned KPI below the minimum. While offices
 * are still being added one at a time the total is short anyway, so corrections stay free.
 */
export const assertChildShare = async (parentAssignmentId, officeId, improvement) => {
  if (!parentAssignmentId || improvement === null) return;
  const parent = await getAssignmentOrThrow(parentAssignmentId);
  const sharing = await sharingOf(parent);
  if (!sharing.shareable) return;
  const before = sharing.offices.find((line) => line.office.id === officeId)?.amount ?? 0;
  const after = round4(sharing.assigned - before + improvement);
  if (sharing.difference >= 0 && after < sharing.parentAmount) throw badRequest(`This leaves ${parent.kpi.code} short by ${round4(sharing.parentAmount - after)}. Its share here is ${before}, so raise another office's share first`);
};

/**
 * Keep the share in step with the KPI saved on the office's contract.
 */
export const recordChildShare = async (parentAssignmentId, officeId, childAssignmentId, improvement, personId) => {
  if (!parentAssignmentId) return;
  const where = { parentAssignmentId_childOfficeId: { parentAssignmentId, childOfficeId: officeId } };
  const existing = await prisma.responsibilityAllocation.findUnique({ where });
  if (existing) await prisma.responsibilityAllocation.update({ where, data: { childAssignmentId, ...(improvement !== null && { allocatedAmount: improvement }) } });
  else if (improvement !== null && improvement > 0) await prisma.responsibilityAllocation.create({ data: { parentAssignmentId, childOfficeId: officeId, childAssignmentId, allocationType: 'DISTRIBUTED', allocatedAmount: improvement, createdByPersonId: personId } });
  await refreshReconciliation(parentAssignmentId);
};

/**
 * A cancelled KPI gives its share back, so the row shows what is now missing.
 */
export const releaseChildShare = async (parentAssignmentId, officeId) => {
  if (!parentAssignmentId) return;
  await prisma.responsibilityAllocation.deleteMany({ where: { parentAssignmentId, childOfficeId: officeId } });
  await refreshReconciliation(parentAssignmentId);
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
  return sharingOf(await getAssignmentOrThrow(id));
};

/**
 * Recheck the split after a share changed, or after an approved change to this assignment's baseline or target.
 */
export const refreshReconciliation = async (id) => {
  const assignment = await getAssignmentOrThrow(id);
  const sharing = await sharingOf(assignment);
  const reconciliationStatus = statusFor(sharing.shareable, sharing.parentAmount, sharing.assigned ?? 0);
  if (reconciliationStatus !== assignment.reconciliationStatus) {
    await prisma.kpiAssignment.update({ where: { id: assignment.id }, data: { reconciliationStatus, reconciliationNote: null } });
  }
};

export default { loadSharing, getAllocations, saveAllocations, assertChildShare, recordChildShare, releaseChildShare, justifyReconciliation, refreshReconciliation };
