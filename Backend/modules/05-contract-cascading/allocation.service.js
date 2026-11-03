import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { parseEnum, parseNumber } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { APPROVED_STATUSES, OPEN_CONTRACT_STATUSES, assertAuthorityOnOffice, canSeeAssignment, contractHomeOffices, getAssignmentOrThrow, requireComment } from './contract.shared.js';
import { numericValue, requiredImprovement, toNumber } from './measurement.js';

/**
 * Module 05 — Sharing: how an office shares the improvement of a KPI between the offices below it.
 * Each office chooses for each KPI it passes down: Equally (the improvement divided between the offices below),
 * Fully (every office below gets the whole improvement) or Custom (each target set by hand). The choice is fixed once
 * the first contract holding the KPI is sent. Only number and money KPIs can be divided.
 * When divided, a share counts once the KPI is on that office's contract, and no office can be given more than what
 * remains. The office can also keep part of it for its own work; what is kept counts as given.
 */

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

/**
 * Keep part of a KPI for the office's own work. What is kept and what is given to the offices below together make
 * the improvement, so no more can be kept than the offices below have left. 0 keeps nothing.
 */
export const saveKept = async (id, data = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  await assertFiscalYearOpen(assignment.contract.fiscalYearId);
  if (assignment.contract.personId) throw conflict('A staff contract is one person\'s work, so nothing on it is kept or shared');
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_MANAGE, assignment.contract.officeId);
  // The office that received the KPI decides what it does itself, not the office above it
  if (!contractHomeOffices(actor).has(assignment.contract.officeId)) throw forbidden(`Only ${assignment.contract.office?.name ?? 'the receiving office'} decides how much of its KPI it keeps`);
  if (!APPROVED_STATUSES.includes(assignment.status)) throw conflict('Part of a KPI can be kept once its contract is signed');

  const sharing = await sharingOf(assignment);
  if (!sharing.shareable) throw conflict(`"${assignment.kpi.name}" is not divided by amounts, so there is no part to keep`);
  const kept = parseNumber(data.amount, 'amount', { required: true });
  if (kept < 0) throw badRequest('amount cannot be negative');
  const most = round4(sharing.parentAmount - sharing.distributed);
  if (kept > most) throw badRequest(`${sharing.distributed} is already given to the offices below, so at most ${Math.max(0, most)} can be kept`);

  await prisma.$transaction([
    prisma.responsibilityAllocation.deleteMany({ where: { parentAssignmentId: assignment.id, allocationType: 'RETAINED' } }),
    ...(kept > 0 ? [prisma.responsibilityAllocation.create({ data: { parentAssignmentId: assignment.id, allocationType: 'RETAINED', allocatedAmount: kept, createdByPersonId: actor.personId } })] : []),
  ]);
  await refreshReconciliation(assignment.id);
  await auditAction(actor, { action: 'KPI_PART_KEPT', entityType: 'kpi_assignment', entityId: assignment.id, oldValues: { kept: sharing.retained }, newValues: { kept } });
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

export default { SHARE_METHODS, isDivisible, loadSharing, getAllocations, saveKept, loadShareContext, resolveShareMethod, targetForShare, applyShareMethod, assertChildShare, recordChildShare, releaseChildShare, justifyReconciliation, refreshReconciliation };
