import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn } from '../../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseEnum, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { contractAssigned, contractRejected, contractSigned } from '../09-notifications/notification.events.js';
import { getSetting } from '../10-system-governance/system.service.js';
import {
  ASSIGNMENT_INCLUDE,
  PERSON_REF,
  assertAuthorityFromAbove,
  assertWorksOnContract,
  contractHomeOffices,
  isOwnStaffContract,
  isStaffContract,
  OPEN_CONTRACT_STATUSES,
  canReadEitherSide,
  canSeeContract,
  canSeeAssignment,
  formatAssignment,
} from './contract.shared.js';
import { loadSharing } from './allocation.service.js';
import { toNumber } from './measurement.js';

/**
 * Module 05 — Performance contracts: one per office per fiscal year, with the office directly above it.
 * Workflow: the office above builds it in DRAFT and assigns it (SUBMITTED). The receiving office reviews it, then
 * signs it (SIGNED) or rejects it (REJECTED), which returns it to the office above to correct and assign again.
 * The top office's self contract has nobody to assign it to, so the top office signs it straight from DRAFT.
 * An office can also give a staff contract to one person working in it, with KPIs from its own contract. It follows
 * the same steps, but only that person signs it, and their results do not feed the office's own figures.
 */

const CONTRACT_STATUSES = ['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'SIGNED', 'CLOSED'];
const OFFICE_REF = { select: { id: true, name: true, code: true } };
const CONTRACT_INCLUDE = {
  office: OFFICE_REF,
  assigningOffice: OFFICE_REF,
  person: PERSON_REF,
  fiscalYear: { select: { id: true, name: true, status: true } },
};
const fullName = (person) => [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');

const getContractOrThrow = async (id) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(id, 'id') }, include: CONTRACT_INCLUDE });
  if (!contract) throw notFound('Contract not found');
  return contract;
};

// Assignments that count towards the contract: everything except the cancelled ones
const countingAssignments = (contractId) =>
  prisma.kpiAssignment.findMany({
    where: { contractId, status: { not: 'CANCELLED' } },
    select: { id: true, status: true, kpi: { select: { name: true } }, baselines: { where: { isCurrent: true }, take: 1, select: { baselineStatus: true } }, weights: { where: { isCurrent: true }, take: 1, select: { weight: true } } },
  });

const weightSummary = (contract, assignments) => {
  const total = Math.round(assignments.reduce((sum, a) => sum + (toNumber(a.weights[0]?.weight) ?? 0), 0) * 10000) / 10000;
  const required = toNumber(contract.requiredTotalWeight);
  return { totalWeight: total, requiredTotalWeight: required, isWeightBalanced: total === required };
};

const transition = async (contract, status, data, actor, action, reason, changeAssignments = () => []) => {
  const [updated] = await prisma.$transaction([prisma.performanceContract.update({ where: { id: contract.id }, data: { status, ...data }, include: CONTRACT_INCLUDE }), ...changeAssignments()]);
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

const FLAGGED = (contractId) => ({ contractId, status: 'SUBMITTED', reviewComment: { not: null } });

const assertStatus = (contract, expected) => {
  if (contract.status !== expected) throw conflict(`This action needs a ${expected} contract; this one is ${contract.status}`);
};

// ===== Queries =====

/**
 * How a contract relates to the offices the person works in today. Null when it is between two other offices.
 */
const directionFor = (contract, ownOfficeIds, actor) => {
  if (isStaffContract(contract)) {
    if (isOwnStaffContract(actor, contract)) return 'MINE';
    return ownOfficeIds.has(contract.officeId) ? 'STAFF' : null;
  }
  if (!contract.assigningOfficeId) return 'SELF';
  if (ownOfficeIds.has(contract.officeId)) return 'RECEIVED';
  return ownOfficeIds.has(contract.assigningOfficeId) ? 'SENT' : null;
};

/**
 * Contracts the actor may see: those of offices below them, and their own once it is assigned to them.
 * mine: only the person's own staff contracts.
 */
export const listContracts = async ({ fiscalYearId, officeId, status, mine } = {}, actor) => {
  const where = {
    ...(mine === 'true' && { personId: actor.personId }),
    ...(fiscalYearId && { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') }),
    ...(officeId && { officeId: parseUuid(officeId, 'officeId') }),
    ...(status && { status: parseEnum(status, 'status', CONTRACT_STATUSES) }),
  };
  const contracts = await prisma.performanceContract.findMany({ where, include: CONTRACT_INCLUDE, orderBy: [{ fiscalYear: { startDate: 'desc' } }, { office: { name: 'asc' } }] });

  const placements = await prisma.officePerson.findMany({ where: { personId: actor.personId, ...activeOn('startDate', 'endDate') }, select: { officeId: true } });
  const ownOfficeIds = new Set(placements.map((placement) => placement.officeId));
  const visible = [];
  for (const contract of contracts) {
    if (await canSeeContract(actor, contract)) visible.push({ ...contract, direction: directionFor(contract, ownOfficeIds, actor) });
  }
  return visible;
};

/**
 * Contract with the assignments the actor may see and its weight total.
 */
/**
 * Past rejections of contracts, for the offices the actor can read. They stay after the contract is assigned again.
 */
export const listRejections = async ({ fiscalYearId } = {}, actor) => {
  const rejections = await prisma.contractRejection.findMany({
    where: fiscalYearId ? { contract: { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') } } : {},
    include: { contract: { include: CONTRACT_INCLUDE }, rejectedBy: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
    orderBy: { rejectedAt: 'desc' },
  });
  const visible = [];
  for (const rejection of rejections) {
    if (await canReadEitherSide(actor, rejection.contract)) visible.push(rejection);
  }
  return visible;
};

export const getContractById = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  if (!(await canSeeContract(actor, contract))) throw notFound('Contract not found');

  const assignments = await prisma.kpiAssignment.findMany({
    where: { contractId: contract.id },
    include: ASSIGNMENT_INCLUDE,
    orderBy: { kpi: { name: 'asc' } },
  });
  const sharing = await loadSharing(assignments);
  const visible = [];
  for (const assignment of assignments) {
    if (await canSeeAssignment(actor, contract, assignment.status)) visible.push({ ...formatAssignment(assignment), sharing: sharing.get(assignment.id) });
  }
  return { ...contract, isMine: isOwnStaffContract(actor, contract), ...weightSummary(contract, assignments.filter((a) => a.status !== 'CANCELLED')), assignments: visible };
};

// ===== Workflow =====

/**
 * The assigning office comes from the hierarchy: it is the receiving office's parent, and it must be allowed to
 * assign KPIs (SRS 2.2.10). Only the top office has no assigning office.
 */
/**
 * Offices a new contract can be created for: active offices directly below the person's own (when that office may
 * assign KPIs), and their own office when it is the top office, for its Self Contract.
 */
export const listContractOffices = async (actor) => {
  const home = [...contractHomeOffices(actor)];
  return prisma.office.findMany({
    where: { isActive: true, OR: [{ parentOfficeId: { in: home }, parent: { canAssignKpi: true } }, { id: { in: home }, parentOfficeId: null }] },
    select: { id: true, name: true, parentOfficeId: true },
    orderBy: { name: 'asc' },
  });
};

/**
 * People a staff contract can be given to: everyone working today in an office where the person manages contracts,
 * themselves included.
 */
export const listContractPeople = async (actor) => {
  const placements = await prisma.officePerson.findMany({
    where: { officeId: { in: [...contractHomeOffices(actor)] }, ...activeOn('startDate', 'endDate'), person: { archivedAt: null } },
    select: { office: OFFICE_REF, position: { select: { title: true, isHead: true } }, person: PERSON_REF },
  });
  return placements
    .map(({ person, office, position }) => ({ id: person.id, name: fullName(person), officeId: office.id, officeName: office.name, position: position?.title ?? null, isHead: Boolean(position?.isHead), isYou: person.id === actor.personId }))
    .sort((a, b) => a.officeName.localeCompare(b.officeName) || Number(b.isHead) - Number(a.isHead) || a.name.localeCompare(b.name));
};

/**
 * A staff contract, given by an office to one person working in it today. The office's own contract for the year
 * must exist, because its KPIs come from there.
 */
const createStaffContract = async (yearId, personId, requestedOfficeId, actor) => {
  const home = contractHomeOffices(actor);
  const placements = await prisma.officePerson.findMany({
    where: { personId, ...activeOn('startDate', 'endDate'), person: { archivedAt: null } },
    select: { officeId: true, office: { select: { id: true, name: true } }, person: PERSON_REF },
  });
  if (placements.length === 0) throw badRequest('This person does not work in any office today');
  const placement = placements.find((item) => home.has(item.officeId) && (!requestedOfficeId || item.officeId === requestedOfficeId));
  if (!placement) throw forbidden('Staff contracts are given by the office the person works in, and you do not manage contracts there');
  const { office, person } = placement;
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, { assigningOfficeId: office.id, officeId: office.id });

  const officeContract = await prisma.performanceContract.findFirst({ where: { fiscalYearId: yearId, officeId: office.id, personId: null } });
  if (!officeContract) throw conflict(`${office.name} has no contract for this fiscal year yet. Its KPIs come from there`);
  const existing = await prisma.performanceContract.findFirst({ where: { fiscalYearId: yearId, officeId: office.id, personId } });
  if (existing) throw conflict(`${fullName(person)} already has a contract in ${office.name} for this fiscal year`);

  const contract = await prisma.performanceContract.create({
    data: { fiscalYearId: yearId, officeId: office.id, assigningOfficeId: office.id, personId, requiredTotalWeight: await getSetting('kpi', 'contract_total_weight') },
    include: CONTRACT_INCLUDE,
  });
  await auditAction(actor, { action: 'CONTRACT_CREATED', entityType: 'performance_contract', entityId: contract.id, newValues: { fiscalYearId: yearId, officeId: office.id, personId } });
  return contract;
};

/**
 * An office's contract, or with personId a staff contract for one person in the actor's office.
 */
export const createContract = async ({ fiscalYearId, officeId, personId } = {}, actor) => {
  const yearId = parseUuid(fiscalYearId, 'fiscalYearId');
  await assertFiscalYearOpen(yearId);
  if (personId) return createStaffContract(yearId, parseUuid(personId, 'personId'), parseUuid(officeId, 'officeId', { required: false }), actor);

  const office = await prisma.office.findUnique({ where: { id: parseUuid(officeId, 'officeId') }, include: { parent: true } });
  if (!office) throw badRequest('Office not found');
  if (!office.isActive) throw badRequest(`Office "${office.name}" is inactive`);
  if (office.parent && !office.parent.canAssignKpi) throw badRequest(`"${office.parent.name}" is not allowed to assign KPIs`);

  const assigningOfficeId = office.parentOfficeId;
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, { assigningOfficeId, officeId: office.id });
  if (assigningOfficeId && !contractHomeOffices(actor).has(assigningOfficeId)) {
    throw forbidden(`Contracts are created by the office directly above. ${office.name} sits under ${office.parent.name}, so its contract is created there`);
  }

  const existing = await prisma.performanceContract.findFirst({ where: { fiscalYearId: yearId, officeId: office.id, personId: null } });
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
 * The office above sends the finished contract to the receiving office, once the weights reach the required total.
 * A pending baseline has no value yet, so it has to be settled first.
 */
/**
 * A contract is complete once it has KPIs, every baseline is settled and the weights reach the required total.
 */
const assertComplete = async (contract) => {
  const assignments = await countingAssignments(contract.id);
  if (assignments.length === 0) throw badRequest('A contract needs at least one KPI');
  const pending = assignments.filter((a) => a.baselines[0]?.baselineStatus === 'PENDING_VERIFICATION').map((a) => a.kpi.name);
  if (pending.length > 0) throw conflict(`These KPIs still have a pending baseline: ${pending.join(', ')}`);
  const { totalWeight, requiredTotalWeight, isWeightBalanced } = weightSummary(contract, assignments);
  if (!isWeightBalanced) throw conflict(`KPI weights total ${totalWeight}, but this contract requires ${requiredTotalWeight}`);
};

export const assignContract = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  if (!contract.assigningOfficeId) throw conflict('A self contract has no office to assign it to. Sign it when it is ready');
  // The office gives a staff contract once its own contract is signed, so the KPIs are settled
  if (isStaffContract(contract) && !(await prisma.performanceContract.findFirst({ where: { fiscalYearId: contract.fiscalYearId, officeId: contract.officeId, personId: null, status: { in: ['SIGNED', 'APPROVED'] } } }))) {
    throw conflict(`${contract.office.name} signs its own contract before giving staff contracts`);
  }
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, contract);
  if (!OPEN_CONTRACT_STATUSES.includes(contract.status)) throw conflict(`Only a draft or rejected contract can be assigned; this one is ${contract.status}`);
  await assertComplete(contract);

  const updated = await transition(contract, 'SUBMITTED', { reviewComment: null }, actor, 'CONTRACT_ASSIGNED', undefined, () => [
    prisma.kpiAssignment.updateMany({ where: { contractId: contract.id, status: { in: ['DRAFT', 'REJECTED'] } }, data: { status: 'SUBMITTED', reviewComment: null } }),
  ]);
  await contractAssigned(updated, actor);
  return updated;
};

/**
 * The receiving office sends the contract back, saying why through flags on its KPIs, an overall note, or both.
 * Flagged KPIs show as rejected and the others return to draft, until the office above assigns it again.
 * The reasons are also copied into the history, because assigning again clears them from the contract.
 */
export const rejectContract = async (id, { comment } = {}, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertWorksOnContract(actor, PERMISSIONS.CONTRACT_ACKNOWLEDGE, contract);
  assertStatus(contract, 'SUBMITTED');
  const note = optionalString(comment, 'comment') ?? null;
  const flagged = await prisma.kpiAssignment.findMany({ where: FLAGGED(contract.id), select: { reviewComment: true, kpi: { select: { name: true } } } });
  if (!note && flagged.length === 0) throw badRequest('Flag at least one KPI or write a note, so the office above knows what to correct');
  const reason = note ?? `${flagged.length} KPI(s) flagged`;
  const flaggedKpis = flagged.map(({ kpi, reviewComment }) => ({ name: kpi.name, note: reviewComment }));

  const updated = await transition(contract, 'REJECTED', { reviewComment: note }, actor, 'CONTRACT_REJECTED', reason, () => [
    prisma.kpiAssignment.updateMany({ where: FLAGGED(contract.id), data: { status: 'REJECTED' } }),
    prisma.kpiAssignment.updateMany({ where: { contractId: contract.id, status: 'SUBMITTED' }, data: { status: 'DRAFT' } }),
    prisma.contractRejection.create({ data: { contractId: contract.id, rejectedByPersonId: actor.personId, note, flaggedKpis } }),
  ]);
  await contractRejected(updated, reason, actor);
  return updated;
};

/**
 * The receiving office accepts the contract by signing. This accepts every KPI on it, with its target and weight,
 * and those KPIs can then pass down to the offices below. The top office signs its self contract from draft.
 */
export const signContract = async (id, actor) => {
  const contract = await getContractOrThrow(id);
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertWorksOnContract(actor, PERMISSIONS.CONTRACT_ACKNOWLEDGE, contract);
  const isSelf = !contract.assigningOfficeId;
  assertStatus(contract, isSelf ? 'DRAFT' : 'SUBMITTED');
  if (isSelf) await assertComplete(contract);
  if ((await prisma.kpiAssignment.count({ where: FLAGGED(contract.id) })) > 0) throw conflict('Some KPIs are flagged. Remove the flags to sign, or reject the contract');

  const now = new Date();
  const accepted = { approvedByPersonId: actor.personId, approvedAt: now };
  const waiting = isSelf ? 'DRAFT' : 'SUBMITTED';
  const onContract = { assignment: { contractId: contract.id, status: waiting }, isCurrent: true };
  const updated = await transition(contract, 'SIGNED', { ...accepted, signedByPersonId: actor.personId, signedAt: now }, actor, 'CONTRACT_SIGNED', undefined, () => [
    prisma.kpiTarget.updateMany({ where: onContract, data: accepted }),
    prisma.kpiWeight.updateMany({ where: onContract, data: accepted }),
    prisma.kpiAssignment.updateMany({ where: { contractId: contract.id, status: waiting }, data: { ...accepted, status: 'ACKNOWLEDGED', acknowledgedByPersonId: actor.personId, acknowledgedAt: now } }),
  ]);
  await contractSigned(updated, actor);
  return updated;
};

export default { listContracts, listContractOffices, listContractPeople, listRejections, getContractById, createContract, assignContract, rejectContract, signContract };
