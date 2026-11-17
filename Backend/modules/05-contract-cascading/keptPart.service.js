import { prisma } from '../../config/database.js';
import { auditAction } from '../../utils/auditLogger.js';
import { activeOn } from '../../utils/dates.js';
import { badRequest, conflict } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { getSetting } from '../10-system-governance/system.service.js';
import { cancelAssignment } from './assignment.service.js';
import { loadSharing, saveKept } from './allocation.service.js';
import { ensureStaffContract } from './contract.service.js';
import { ASSIGNMENT_INCLUDE, OPEN_CONTRACT_STATUSES, PERSON_REF, addVersion, getAssignmentOrThrow } from './contract.shared.js';
import { numericValue, toNumber } from './measurement.js';

/**
 * Module 05 — Who does the part of a KPI an office keeps. Keeping part of a received KPI names a person to do it: by
 * default whoever heads the office today. The KPI goes on that person's staff contract for the year, which is made if
 * they have none, with the kept amount as their improvement. Their results then add up into the office's own figure.
 * The KPI starts with no weight, so the person sets the weights of the whole contract before it is sent.
 */

const round4 = (value) => Math.round(value * 10000) / 10000;
const fullName = (person) => [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');
const OPEN = OPEN_CONTRACT_STATUSES;

const headOf = async (officeId) => {
  const placement = await prisma.officePerson.findFirst({
    where: { officeId, ...activeOn('startDate', 'endDate'), position: { isHead: true, archivedAt: null }, person: { archivedAt: null } },
    select: { person: PERSON_REF },
    orderBy: { startDate: 'asc' },
  });
  return placement?.person ?? null;
};

/**
 * Who will do the kept part: the person asked for, who must work in the office today, or else the office's head.
 */
const resolveHolder = async (assignment, personId) => {
  const { office, officeId } = assignment.contract;
  if (personId) {
    const placement = await prisma.officePerson.findFirst({
      where: { officeId, personId: parseUuid(personId, 'personId'), ...activeOn('startDate', 'endDate'), person: { archivedAt: null } },
      select: { person: PERSON_REF },
    });
    if (!placement) throw badRequest(`That person does not work in ${office?.name ?? 'this office'} today`);
    return placement.person;
  }
  const head = await headOf(officeId);
  if (!head) throw badRequest(`${office?.name ?? 'This office'} has no head today. Choose the person who will do this part`);
  return head;
};

// The staff contracts that already hold a part of this KPI
const heldParts = (assignmentId) =>
  prisma.kpiAssignment.findMany({
    where: { sourceAssignmentId: assignmentId, status: { not: 'CANCELLED' }, contract: { personId: { not: null } } },
    include: { contract: { select: { id: true, status: true, personId: true, person: PERSON_REF } }, targets: { where: { isCurrent: true }, take: 1 } },
  });

/**
 * The person's target: the office's baseline moved by the kept amount, the same way a share is given to an office below.
 */
const targetFor = (assignment, kept) => {
  const { kpi } = assignment;
  const start = numericValue(kpi, assignment.baselines[0]);
  const value = round4(kpi.direction === 'LOWER_IS_BETTER' ? start - kept : start + kept);
  if (value < 0) throw badRequest(`Starting from ${start}, a reduction of ${kept} would go below zero`);
  return value;
};

/**
 * Everything that can stop the kept part going onto the holder's contract, checked before anything is saved.
 */
const checkHold = async (assignment, holder, kept, held) => {
  const other = held.find((part) => part.contract.personId !== holder.id);
  if (other) throw conflict(`${fullName(other.contract.person)} already holds this part of "${assignment.kpi.name}". Lower it to 0 first, then keep it for ${fullName(holder)}`);

  const mine = held.find((part) => part.contract.personId === holder.id);
  const target = targetFor(assignment, kept);
  if (mine) {
    if (!OPEN.includes(mine.contract.status) && toNumber(mine.targets[0]?.value) !== target) {
      throw conflict(`${fullName(holder)}'s contract is already ${mine.contract.status.toLowerCase()}, so the kept amount of "${assignment.kpi.name}" cannot change there`);
    }
    return;
  }
  const contract = await prisma.performanceContract.findFirst({ where: { fiscalYearId: assignment.contract.fiscalYearId, officeId: assignment.contract.officeId, personId: holder.id }, select: { status: true } });
  if (contract && !OPEN.includes(contract.status)) {
    throw conflict(`${fullName(holder)}'s contract for this year is already ${contract.status.toLowerCase()}, so this KPI cannot be added to it. Choose a person whose contract is still a draft`);
  }
};

const baselineCopy = (baseline, actor) => ({
  baselineStatus: baseline.baselineStatus,
  value: baseline.value,
  numerator: baseline.numerator,
  denominator: baseline.denominator,
  scaleLevelId: baseline.scaleLevelId,
  currencyId: baseline.currencyId,
  unknownJustification: baseline.unknownJustification,
  verifiedByPersonId: baseline.verifiedByPersonId,
  verifiedAt: baseline.verifiedAt,
  createdByPersonId: actor.personId,
});

/**
 * Put the kept part on the holder's staff contract: add the KPI, or set its target again if it is already there.
 */
const putOnContract = async (assignment, holder, kept, actor) => {
  const { kpi } = assignment;
  const { contract } = await ensureStaffContract(assignment.contract.fiscalYearId, holder.id, assignment.contract.officeId, actor);
  const targetValue = targetFor(assignment, kept);
  const target = { value: targetValue, currencyId: kpi.measurementType === 'MONEY' ? kpi.currencyId : null, createdByPersonId: actor.personId };
  const existing = await prisma.kpiAssignment.findUnique({ where: { contractId_kpiId: { contractId: contract.id, kpiId: assignment.kpiId } }, include: ASSIGNMENT_INCLUDE });

  if (existing && existing.status !== 'CANCELLED') {
    // Already there: only its target follows the kept amount, and only while the contract is still being built
    if (OPEN.includes(contract.status) && toNumber(existing.targets[0]?.value) !== targetValue) await prisma.kpiTarget.update({ where: { id: existing.targets[0].id }, data: { value: targetValue } });
    return { contract, assignmentId: existing.id, created: false };
  }

  const fields = {
    sourceAssignmentId: assignment.id,
    reportingFrequencyId: assignment.reportingFrequencyId,
    scopeRelation: kpi.isAdditive ? 'EXCLUSIVE_COMPLETE' : 'OVERLAPPING',
    maxOverAllocationPercent: await getSetting('kpi', 'default_max_over_allocation_percent'),
    createdByPersonId: actor.personId,
  };
  const baseline = baselineCopy(assignment.baselines[0], actor);
  const saved = existing
    ? await prisma.$transaction(async (tx) => {
        await addVersion(tx, tx.kpiBaseline, existing.id, baseline);
        await addVersion(tx, tx.kpiTarget, existing.id, target);
        await addVersion(tx, tx.kpiWeight, existing.id, { weight: 0, createdByPersonId: actor.personId });
        return tx.kpiAssignment.update({ where: { id: existing.id }, data: { ...fields, status: 'DRAFT', reviewComment: null, approvedByPersonId: null, approvedAt: null, acknowledgedByPersonId: null, acknowledgedAt: null } });
      })
    : await prisma.kpiAssignment.create({
        data: { contractId: contract.id, kpiId: assignment.kpiId, ...fields, baselines: { create: baseline }, targets: { create: target }, weights: { create: { weight: 0, createdByPersonId: actor.personId } } },
      });
  return { contract, assignmentId: saved.id, created: true };
};

/**
 * Take the kept part off the holder's contract once the office keeps nothing. Only while that contract is still being
 * built: a part already sent or signed stays, because the person may already be working on it.
 */
const takeOffContract = async (held, actor) => {
  for (const part of held) {
    await cancelAssignment(part.id, { comment: 'The office no longer keeps this part' }, actor);
  }
};

/**
 * Keep part of a received KPI for the office, and give that part to a person to do. Wraps the keep itself, so what is
 * kept and who holds it always agree.
 */
export const keepPart = async (id, data = {}, actor) => {
  const assignment = await getAssignmentOrThrow(id);
  const kept = Number(data.amount) || 0;
  const held = await heldParts(assignment.id);
  const previous = toNumber((await loadSharing([assignment])).get(assignment.id).retained) ?? 0;

  let holder = null;
  if (kept > 0) {
    holder = await resolveHolder(assignment, data.personId);
    await checkHold(assignment, holder, kept, held);
  } else if (held.some((part) => !OPEN.includes(part.contract.status))) {
    const part = held.find((candidate) => !OPEN.includes(candidate.contract.status));
    throw conflict(`${fullName(part.contract.person)}'s contract is already ${part.contract.status.toLowerCase()}, so the kept part of "${assignment.kpi.name}" cannot be taken off it`);
  }

  // The keep checks the amount and who may do it, then saves it
  await saveKept(id, data, actor);

  try {
    if (kept > 0) {
      const placed = await putOnContract(assignment, holder, kept, actor);
      await auditAction(actor, {
        action: 'KPI_PART_GIVEN_TO_PERSON',
        entityType: 'kpi_assignment',
        entityId: assignment.id,
        newValues: { personId: holder.id, contractId: placed.contract.id, staffAssignmentId: placed.assignmentId, kept, contractCreated: placed.created },
      });
    } else {
      await takeOffContract(held, actor);
    }
  } catch (error) {
    // Do not leave the kept amount saved without a holder
    await saveKept(id, { amount: previous }, actor).catch(() => {});
    throw error;
  }
  const sharing = (await loadSharing([await getAssignmentOrThrow(id)])).get(id);
  return sharing;
};

export default { keepPart };
