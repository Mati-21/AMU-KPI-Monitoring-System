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
 * Each office chooses for each KPI it passes down: Equally (the improvement divided between the offices below),
 * Fully (every office below gets the whole improvement) or Custom (each target set by hand). The choice is fixed once
 * the first contract holding the KPI is sent. Only number and money KPIs can be divided.
 * When divided, a share counts once the KPI is on that office's contract, and no office can be given more than what
 * remains. A share can be planned in the Share window before that office has a contract, but it counts only then.
 */

const WINDOW_METHODS = ['EQUAL', 'CUSTOM'];
export const SHARE_METHODS = ['EQUAL', 'FULL', 'CUSTOM'];
const METHOD_WORDS = { EQUAL: 'equally', FULL: 'fully', CUSTOM: 'by custom targets' };
const SPLITTABLE_TYPES = ['NUMBER', 'MONEY'];
// A contract that has left the office above fixes how its KPIs are shared
const SENT_STATUSES = ['SUBMITTED', 'APPROVED', 'ACKNOWLEDGED', 'REJECTED'];
const LEVEL_TYPES = ['STAGE', 'CATEGORY'];
const OFFICE_REF = { select: { id: true, name: true, code: true } };
const current = { where: { isCurrent: true }, take: 1 };
const round4 = (value) => Math.round(value * 10000) / 10000;
const floor2 = (value) => Math.floor(value * 100) / 100;

const parentAmountOf = (assignment) => requiredImprovement(assignment.kpi, assignment.baselines[0], assignment.targets[0]);

export const isDivisible = (kpi) => SPLITTABLE_TYPES.includes(kpi.measurementType) && kpi.isAdditive;

/**
 * An amount divided evenly to two decimals between offices in name order. The last takes the rounding, so the parts
 * add up exactly: 60 between 7 is six times 8.57 and 8.58.
 */
const equalSplit = (total, offices) => {
  if (offices.length === 0) return new Map();
  const each = floor2(total / offices.length);
  return new Map(offices.map((office, index) => [office.id, index === offices.length - 1 ? round4(total - each * (offices.length - 1)) : each]));
};

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

const describeSharing = (assignment, rows, children, officesBelow) => {
  const parentAmount = parentAmountOf(assignment);
  const divisible = isDivisible(assignment.kpi);
  const sent = children.some((child) => SENT_STATUSES.includes(child.status));
  const chosen = assignment.distributionMethod === 'NONE' ? null : assignment.distributionMethod;
  // A KPI sent before a choice was recorded keeps the targets it was sent with
  const method = chosen ?? (sent ? 'CUSTOM' : null);
  const base = {
    method,
    locked: sent,
    divisible,
    parentAmount,
    officesBelow,
    equalAmounts: method === 'EQUAL' && divisible && parentAmount > 0 ? Object.fromEntries(equalSplit(parentAmount, officesBelow)) : null,
  };
  // Only a divided KPI is tracked against its improvement. Shared fully, every office gets all of it.
  if (!divisible || !(parentAmount > 0) || method === 'FULL') {
    return { ...base, shareable: false, offices: children.map((child) => ({ office: child.contract.office, amount: null, assignmentId: child.id, status: child.status, locked: !OPEN_CONTRACT_STATUSES.includes(child.status) })) };
  }

  const shares = rows.filter((row) => row.allocationType === 'DISTRIBUTED');
  const officeIds = new Set([...shares.map((row) => row.childOfficeId), ...children.map((child) => child.contract.office.id)]);
  const offices = [...officeIds]
    .map((id) => {
      const row = shares.find((candidate) => candidate.childOfficeId === id);
      const child = children.find((candidate) => candidate.contract.office.id === id);
      return officeLine(row?.childOffice ?? child.contract.office, row, child);
    })
    .sort((a, b) => a.office.name.localeCompare(b.office.name));

  // Only offices holding the KPI on their contract count; a planned share is shown but not yet given
  const distributed = round4(offices.reduce((sum, line) => sum + (line.assignmentId ? line.amount ?? 0 : 0), 0));
  const planned = round4(offices.reduce((sum, line) => sum + (line.assignmentId ? 0 : line.amount ?? 0), 0));
  const retained = toNumber(rows.find((row) => row.allocationType === 'RETAINED')?.allocatedAmount) ?? 0;
  const assigned = round4(distributed + retained);
  return { ...base, shareable: true, distributed, planned, retained, assigned, difference: round4(assigned - parentAmount), offices };
};

/**
 * The sharing of many assignments, by assignment id.
 */
export const loadSharing = async (assignments) => {
  const ids = assignments.map((assignment) => assignment.id);
  const officeIds = [...new Set(assignments.map((assignment) => assignment.contract.officeId))];
  const [rows, children, below] = await Promise.all([
    prisma.responsibilityAllocation.findMany({ where: { parentAssignmentId: { in: ids } }, include: { childOffice: OFFICE_REF } }),
    prisma.kpiAssignment.findMany({
      where: { parentAssignmentId: { in: ids }, status: { not: 'CANCELLED' } },
      include: { kpi: { include: { scale: { include: { levels: true } } } }, baselines: current, targets: current, contract: { select: { office: OFFICE_REF } } },
    }),
    prisma.office.findMany({ where: { parentOfficeId: { in: officeIds }, isActive: true }, select: { id: true, name: true, parentOfficeId: true }, orderBy: { name: 'asc' } }),
  ]);
  return new Map(
    assignments.map((assignment) => [
      assignment.id,
      describeSharing(
        assignment,
        rows.filter((row) => row.parentAssignmentId === assignment.id),
        children.filter((child) => child.parentAssignmentId === assignment.id),
        below.filter((office) => office.parentOfficeId === assignment.contract.officeId).map(({ id, name }) => ({ id, name }))
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

  const asked = parseEnum(data.distributionMethod, 'distributionMethod', WINDOW_METHODS);
  // Once a contract holding the KPI is sent, amounts can still be set by hand but the way it is shared stays
  const method = sharing.locked ? sharing.method : asked;
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

// ===== Choosing how a KPI is shared, when it goes on the contract of an office below =====

export const loadShareContext = async (parentAssignmentId) => {
  const parent = await getAssignmentOrThrow(parentAssignmentId);
  return { parent, sharing: await sharingOf(parent) };
};

/**
 * The way the KPI above is shared for this office: the fixed one once a contract with it was sent, otherwise the one
 * asked for, the one already chosen, or Custom.
 */
export const resolveShareMethod = ({ parent, sharing }, requested) => {
  const asked = requested === undefined || requested === null || requested === '' ? undefined : parseEnum(requested, 'shareMethod', SHARE_METHODS);
  if (sharing.locked) {
    if (asked && asked !== sharing.method) throw conflict(`"${parent.kpi.name}" is shared ${METHOD_WORDS[sharing.method]}, because a contract holding it was already sent. Every office below gets it the same way`);
    return sharing.method;
  }
  const method = asked ?? sharing.method ?? 'CUSTOM';
  if (method === 'EQUAL') {
    if (!sharing.divisible) throw badRequest(`"${parent.kpi.name}" cannot be shared equally: only number and money KPIs can be divided`);
    if (!(sharing.parentAmount > 0)) throw badRequest(`"${parent.kpi.name}" has no improvement to divide yet`);
    if (sharing.officesBelow.length === 0) throw badRequest('There is no active office below to share with');
  }
  return method;
};

const parentTarget = (parent) => {
  const target = parent.targets[0];
  return target.scaleLevelId ? { scaleLevelId: target.scaleLevelId } : { value: toNumber(target.value) };
};

/**
 * The target an office gets when the KPI above is shared equally or fully: its own baseline moved by its share.
 * Where no improvement can be worked out (levels, maintain, an unknown baseline), fully means the same target as
 * above. Custom returns null: the target is the one entered.
 */
export const targetForShare = ({ parent, sharing }, method, kpi, baseline, officeId) => {
  if (method === 'CUSTOM') return null;
  const noImprovement = LEVEL_TYPES.includes(kpi.measurementType) || kpi.direction === 'MAINTAIN' || sharing.parentAmount === null || baseline.baselineStatus !== 'KNOWN';
  if (noImprovement) {
    if (method === 'FULL') return parentTarget(parent);
    throw badRequest('Sharing equally needs a known baseline, because the target is the baseline plus the share');
  }
  const amount = method === 'EQUAL' ? equalSplit(sharing.parentAmount, sharing.officesBelow).get(officeId) : sharing.parentAmount;
  if (amount === undefined) throw badRequest('This office is not an active office directly below, so it has no equal share');
  const start = numericValue(kpi, baseline);
  const value = round4(kpi.direction === 'LOWER_IS_BETTER' ? start - amount : start + amount);
  if (value < 0) throw badRequest(`Starting from ${start}, a reduction of ${amount} would go below zero`);
  return { value };
};

/**
 * Record a new choice for the KPI above and bring the drafts of the other offices below in line with it. A choice
 * fixed by a sent contract is not changed.
 */
export const applyShareMethod = async ({ parent, sharing }, method, personId, exceptAssignmentId) => {
  if (sharing.locked || method === sharing.method) return;
  await prisma.kpiAssignment.update({ where: { id: parent.id }, data: { distributionMethod: method } });

  const children = await prisma.kpiAssignment.findMany({
    where: { parentAssignmentId: parent.id, status: { not: 'CANCELLED' } },
    include: { kpi: { include: { scale: { include: { levels: true } } } }, baselines: current, targets: current, contract: { select: { office: OFFICE_REF } } },
  });
  // Shares are given office by office as the KPI goes on their contracts, so a new choice reserves nothing ahead
  if (method === 'FULL') await prisma.responsibilityAllocation.deleteMany({ where: { parentAssignmentId: parent.id, allocationType: 'DISTRIBUTED' } });

  if (method !== 'CUSTOM') {
    const context = { parent, sharing };
    for (const child of children.filter((candidate) => ['DRAFT', 'REJECTED'].includes(candidate.status) && candidate.id !== exceptAssignmentId)) {
      try {
        const target = targetForShare(context, method, child.kpi, child.baselines[0], child.contract.office.id);
        await prisma.kpiTarget.update({ where: { id: child.targets[0].id }, data: target.scaleLevelId ? { scaleLevelId: target.scaleLevelId, value: null } : { value: target.value } });
        if (method === 'EQUAL') await recordChildShare(parent.id, child.contract.office.id, child.id, round4(Math.abs(target.value - numericValue(child.kpi, child.baselines[0]))), personId);
      } catch {
        // A draft whose target cannot be worked out yet, such as one with an unknown baseline, keeps its target
      }
    }
  }
  await refreshReconciliation(parent.id);
};

/**
 * The most an office can be given: what remains of the improvement, plus what it already holds.
 */
const mostFor = (sharing, officeId) => {
  const line = sharing.offices.find((candidate) => candidate.office.id === officeId && candidate.assignmentId);
  return round4(sharing.parentAmount - sharing.assigned + (line?.amount ?? 0));
};

/**
 * A KPI saved on an office's contract can take at most what remains of the improvement above. Once everything is
 * given, it cannot be lowered either, as that would leave the KPI above short.
 */
export const assertChildShare = async (parentAssignmentId, officeId, improvement) => {
  if (!parentAssignmentId || improvement === null) return;
  const parent = await getAssignmentOrThrow(parentAssignmentId);
  const sharing = await sharingOf(parent);
  if (!sharing.shareable) return;
  const most = mostFor(sharing, officeId);
  if (improvement > most) throw badRequest(`"${parent.kpi.name}" has ${Math.max(0, most)} left to share, so this office can get at most ${Math.max(0, most)}, not ${improvement}`);
  const before = round4(sharing.parentAmount - most);
  const after = round4(before + improvement);
  if (sharing.difference >= 0 && after < sharing.parentAmount) throw badRequest(`This leaves "${parent.kpi.name}" short by ${round4(sharing.parentAmount - after)}, so raise another office's share first`);
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

export default { SHARE_METHODS, isDivisible, loadSharing, getAllocations, saveAllocations, loadShareContext, resolveShareMethod, targetForShare, applyShareMethod, assertChildShare, recordChildShare, releaseChildShare, justifyReconciliation, refreshReconciliation };
