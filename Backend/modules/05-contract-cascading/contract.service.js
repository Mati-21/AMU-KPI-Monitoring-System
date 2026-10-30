import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { parseEnum, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { getSetting } from '../10-system-governance/system.service.js';
import {
  APPROVED_STATUSES,
  ASSIGNMENT_INCLUDE,
  assertAuthorityFromAbove,
  assertAuthorityOnOffice,
  canSeeAssignment,
  formatAssignment,
  requireComment,
} from './contract.shared.js';
import { toNumber } from './measurement.js';

/**
 * Module 05 — Performance contracts: one per office per fiscal year, with the office directly above it.
 * Workflow: DRAFT -> SUBMITTED -> APPROVED -> SIGNED (a rejected contract goes back to DRAFT).
 */

const CONTRACT_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SIGNED', 'CLOSED'];
const OFFICE_REF = { select: { id: true, name: true, code: true } };
const CONTRACT_INCLUDE = {
  office: OFFICE_REF,
  assigningOffice: OFFICE_REF,
  fiscalYear: { select: { id: true, name: true, status: true } },
};

const getContractOrThrow = async (id) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(id, 'id') }, include: CONTRACT_INCLUDE });
  if (!contract) throw notFound('Contract not found');
  return contract;
};

// Assignments that count towards the contract: everything except the cancelled ones
const countingAssignments = (contractId) =>
  prisma.kpiAssignment.findMany({
    where: { contractId, status: { not: 'CANCELLED' } },
    select: { id: true, status: true, kpi: { select: { code: true } }, weights: { where: { isCurrent: true }, take: 1, select: { weight: true } } },
  });

const weightSummary = (contract, assignments) => {
  const total = Math.round(assignments.reduce((sum, a) => sum + (toNumber(a.weights[0]?.weight) ?? 0), 0) * 10000) / 10000;
  const required = toNumber(contract.requiredTotalWeight);
  return { totalWeight: total, requiredTotalWeight: required, isWeightBalanced: total === required };
};

const transition = async (contract, status, data, actor, action, reason) => {
  const updated = await prisma.performanceContract.update({ where: { id: contract.id }, data: { status, ...data }, include: CONTRACT_INCLUDE });
  await auditAction(actor, {
    action,
    entityType: 'performance_contract',
    entityId: contract.id,
    oldValues: { status: contract.status },
    newValues: { status },
    reason,
  });
  return updated;
};

const assertStatus = (contract, expected) => {
  if (contract.status !== expected) throw conflict(`This action needs a ${expected} contract; this one is ${contract.status}`);
};

// ===== Queries =====

/**
 * Contracts the actor may see: their own and those of offices below them.
 */
export const listContracts = async ({ fiscalYearId, officeId, status } = {}, actor) => {
  const where = {
    ...(fiscalYearId && { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') }),
    ...(officeId && { officeId: parseUuid(officeId, 'officeId') }),
    ...(status && { status: parseEnum(status, 'status', CONTRACT_STATUSES) }),
  };
  const contracts = await prisma.performanceContract.findMany({ where, include: CONTRACT_INCLUDE, orderBy: [{ fiscalYear: { startDate: 'desc' } }, { office: { name: 'asc' } }] });

  const allowed = new Map();
  for (const officeKey of new Set(contracts.map((contract) => contract.officeId))) {
    allowed.set(officeKey, await actor.access.can(PERMISSIONS.CONTRACT_READ, officeKey));
  }
  return contracts.filter((contract) => allowed.get(contract.officeId));
};

/**
 * Contract with the assignments the actor may see and its weight total.
 */
export const getContractById = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_READ, contract.officeId);

  const assignments = await prisma.kpiAssignment.findMany({
    where: { contractId: contract.id },
    include: ASSIGNMENT_INCLUDE,
    orderBy: { kpi: { code: 'asc' } },
  });
  const visible = [];
  for (const assignment of assignments) {
    if (await canSeeAssignment(actor, contract, assignment.status)) visible.push(formatAssignment(assignment));
  }
  return { ...contract, ...weightSummary(contract, assignments.filter((a) => a.status !== 'CANCELLED')), assignments: visible };
};

// ===== Workflow =====

/**
 * The assigning office comes from the hierarchy: it is the receiving office's parent, and it must be allowed to
 * assign KPIs (SRS 2.2.10). Only the top office has no assigning office.
 */
export const createContract = async ({ fiscalYearId, officeId } = {}, actor) => {
  const yearId = parseUuid(fiscalYearId, 'fiscalYearId');
  await assertFiscalYearOpen(yearId);

  const office = await prisma.office.findUnique({ where: { id: parseUuid(officeId, 'officeId') }, include: { parent: true } });
  if (!office) throw badRequest('Office not found');
  if (!office.isActive) throw badRequest(`Office "${office.name}" is inactive`);
  if (office.parent && !office.parent.canAssignKpi) throw badRequest(`"${office.parent.name}" is not allowed to assign KPIs`);

  const assigningOfficeId = office.parentOfficeId;
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, { assigningOfficeId });

  const existing = await prisma.performanceContract.findFirst({ where: { fiscalYearId: yearId, officeId: office.id } });
  if (existing) throw conflict(`${office.name} already has a contract for this fiscal year`);

  const contract = await prisma.performanceContract.create({
    data: { fiscalYearId: yearId, officeId: office.id, assigningOfficeId, requiredTotalWeight: await getSetting('kpi', 'contract_total_weight') },
    include: CONTRACT_INCLUDE,
  });
  await auditAction(actor, {
    action: 'CONTRACT_CREATED',
    entityType: 'performance_contract',
    entityId: contract.id,
    newValues: { fiscalYearId: yearId, officeId: office.id, assigningOfficeId },
  });
  return contract;
};

/**
 * Submit once every assignment has at least been submitted and the weights reach the required total (SRS 9.2).
 */
export const submitContract = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, contract);
  assertStatus(contract, 'DRAFT');

  const assignments = await countingAssignments(contract.id);
  if (assignments.length === 0) throw badRequest('A contract needs at least one KPI assignment');
  const notReady = assignments.filter((a) => a.status === 'DRAFT' || a.status === 'REJECTED').map((a) => a.kpi.code);
  if (notReady.length > 0) throw conflict(`Submit these assignments first: ${notReady.join(', ')}`);
  const { totalWeight, requiredTotalWeight, isWeightBalanced } = weightSummary(contract, assignments);
  if (!isWeightBalanced) throw conflict(`KPI weights total ${totalWeight}, but this contract requires ${requiredTotalWeight}`);

  return transition(contract, 'SUBMITTED', { reviewComment: null }, actor, 'CONTRACT_SUBMITTED');
};

export const approveContract = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, contract);
  assertStatus(contract, 'SUBMITTED');

  const assignments = await countingAssignments(contract.id);
  const notApproved = assignments.filter((a) => !APPROVED_STATUSES.includes(a.status)).map((a) => a.kpi.code);
  if (notApproved.length > 0) throw conflict(`These assignments are not approved yet: ${notApproved.join(', ')}`);

  return transition(contract, 'APPROVED', { approvedByPersonId: actor.personId, approvedAt: new Date() }, actor, 'CONTRACT_APPROVED');
};

export const rejectContract = async (id, { comment } = {}, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_APPROVE, contract);
  assertStatus(contract, 'SUBMITTED');
  const reason = requireComment(comment);
  return transition(contract, 'DRAFT', { reviewComment: reason }, actor, 'CONTRACT_REJECTED', reason);
};

/**
 * The receiving office signs once it has acknowledged every assignment.
 */
export const signContract = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityOnOffice(actor, PERMISSIONS.CONTRACT_ACKNOWLEDGE, contract.officeId);
  assertStatus(contract, 'APPROVED');

  const assignments = await countingAssignments(contract.id);
  const pending = assignments.filter((a) => a.status !== 'ACKNOWLEDGED').map((a) => a.kpi.code);
  if (pending.length > 0) throw conflict(`Acknowledge these assignments first: ${pending.join(', ')}`);

  return transition(contract, 'SIGNED', { signedByPersonId: actor.personId, signedAt: new Date() }, actor, 'CONTRACT_SIGNED');
};

export default { listContracts, getContractById, createContract, submitContract, approveContract, rejectContract, signContract };
