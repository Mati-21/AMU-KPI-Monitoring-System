import { prisma } from '../../config/database.js';
import { saveKept } from '../../modules/05-contract-cascading/allocation.service.js';
import { createAssignment } from '../../modules/05-contract-cascading/assignment.service.js';
import { assignContract, createContract, signContract } from '../../modules/05-contract-cascading/contract.service.js';
import { actorFor } from '../seedBase.js';
import { ACADEMIC_CUSTOM, PLAN } from './plan.js';
import { OFFICES } from './university.js';

/**
 * A year's contracts, made through the same services the screens use:
 *  - office contracts: the President's self contract holds every KPI, and each office passes its KPIs to the offices
 *    directly below it. Counts and amounts are shared equally between the offices that receive them, or given fully
 *    to the only one that does; everything else is given fully. All are signed.
 *  - staff contracts: the head of every office at the bottom divides most of the office's counts and amounts between
 *    its three staff, and takes the office's rates, stages and ratings on their own contract. All are signed. The
 *    people's results then make up the office's own figures.
 */

const round = (value) => Math.round(value * 10000) / 10000;
const isAmount = (kpi) => kpi.type === 'NUMBER' || kpi.type === 'MONEY';

/**
 * Weights that add up to exactly 100: as even as whole numbers allow.
 */
const weightsFor = (count) => {
  const each = Math.floor(100 / count);
  return Array.from({ length: count }, (_, index) => (index < 100 - each * count ? each + 1 : each));
};

// The President's own baseline and target, in the form a contract takes
const topValues = (kpi) => {
  const plan = PLAN[kpi.name];
  const level = (name) => ({ scaleLevelId: kpi.levels.find((item) => item.name === name).id });
  if (kpi.type === 'STAGE' || kpi.type === 'CATEGORY') return { baseline: { status: 'KNOWN', ...level(plan.base) }, target: level(plan.target) };
  if (kpi.parts) return { baseline: { status: 'KNOWN', numerator: plan.base[0], denominator: plan.base[1] }, target: { value: plan.target } };
  return { baseline: { status: 'KNOWN', value: plan.base }, target: { value: plan.target } };
};

/**
 * An office's own starting point for a KPI it receives. A count or an amount is its part of the office above's
 * baseline; a rate or a level starts where the office above starts.
 */
const childBaseline = (kpi, parentBaseline, divisor) => {
  if (parentBaseline.scaleLevelId) return { status: 'KNOWN', scaleLevelId: parentBaseline.scaleLevelId };
  if (kpi.parts) {
    const rate = Number(parentBaseline.numerator) / Number(parentBaseline.denominator);
    return { status: 'KNOWN', numerator: round(rate * 200), denominator: 200 };
  }
  return { status: 'KNOWN', value: Math.round(Number(parentBaseline.value) / divisor) };
};

/**
 * Every office contract of the year, top down. Returns the head actors, used again for the staff contracts.
 */
export const buildOfficeContracts = async (year, offices, people, kpis) => {
  const actors = {};
  for (const [key, person] of Object.entries(people.heads)) actors[key] = await actorFor(person, 'seed:demo');

  const top = await createContract({ fiscalYearId: year.id, officeId: offices.president.id }, actors.president);
  const held = { president: {} };
  const topWeights = weightsFor(kpis.length);
  for (const [index, kpi] of kpis.entries()) {
    const values = topValues(kpi);
    const assignment = await createAssignment(top.id, { kpiId: kpi.id, weight: topWeights[index], ...values }, actors.president);
    held.president[kpi.name] = { id: assignment.id, kpi, baseline: values.baseline };
  }
  await signContract(top.id, actors.president);

  // Each office passes its KPIs to the offices directly below it, one level at a time
  const pass = async (parentKey) => {
    const children = OFFICES.filter((office) => office.parent === parentKey);
    for (const child of children) {
      const receives = (kpi) => parentKey !== 'president' || PLAN[kpi.name].to.includes(child.key);
      const received = Object.values(held[parentKey]).filter(({ kpi }) => receives(kpi));
      if (received.length === 0) continue;
      const contract = await createContract({ fiscalYearId: year.id, officeId: offices[child.key].id }, actors[parentKey]);
      held[child.key] = {};
      const weights = weightsFor(received.length);
      for (const [index, item] of received.entries()) {
        const sharers = children.filter((sibling) => parentKey !== 'president' || PLAN[item.kpi.name].to.includes(sibling.key)).length;
        const custom = parentKey === 'academic' && item.kpi.name === ACADEMIC_CUSTOM.kpi;
        const shareMethod = custom ? 'CUSTOM' : isAmount(item.kpi) && !item.kpi.single && sharers > 1 ? 'EQUAL' : 'FULL';
        const baseline = childBaseline(item.kpi, item.baseline, sharers);
        const target = custom ? { value: baseline.value + ACADEMIC_CUSTOM.shares[child.key] } : undefined;
        const assignment = await createAssignment(contract.id, { kpiId: item.kpi.id, parentAssignmentId: item.id, shareMethod, weight: weights[index], baseline, ...(target && { target }) }, actors[parentKey]);
        held[child.key][item.kpi.name] = { id: assignment.id, kpi: item.kpi, baseline };
      }
      await assignContract(contract.id, actors[parentKey]);
      await signContract(contract.id, actors[child.key]);
      await pass(child.key);
    }
  };
  await pass('president');
  // Once its contract is signed and the rest is given out, the Academic Office keeps its part
  await saveKept(held.academic[ACADEMIC_CUSTOM.kpi].id, { amount: ACADEMIC_CUSTOM.keep }, actors.academic);
  return actors;
};

// ===== Staff contracts =====

const measureOf = (row) => {
  if (row.scaleLevelId) return { scaleLevelId: row.scaleLevelId };
  if (row.numerator !== null && row.denominator !== null) return { numerator: Number(row.numerator), denominator: Number(row.denominator) };
  return { value: Number(row.value) };
};

/**
 * An amount divided into equal parts, rounded to the step. The last part takes the rounding, so they add up exactly.
 */
const split = (total, count, step) => {
  const each = Math.floor(total / count / step) * step;
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? total - each * (count - 1) : each));
};

/**
 * Each holder's part of an office's count or amount: the baseline and the target divided between them, so the
 * people's targets add up to the office's.
 */
const partsOf = (kpi, assignment, holders) => {
  const step = kpi.type === 'MONEY' ? 1000 : 1;
  const baselines = split(Number(assignment.baselines[0].value), holders, step);
  const targets = split(Number(assignment.targets[0].value), holders, step);
  return baselines.map((baseline, index) => ({ baseline: { status: 'KNOWN', value: baseline }, target: { value: targets[index] } }));
};

const sameAsOffice = (assignment) => ({ baseline: { status: 'KNOWN', ...measureOf(assignment.baselines[0]) }, target: measureOf(assignment.targets[0]) });

const giveStaffContract = async (year, office, person, lines, headActor) => {
  const contract = await createContract({ fiscalYearId: year.id, personId: person.id, officeId: office.id }, headActor);
  const weights = weightsFor(lines.length);
  for (const [index, { assignment, values }] of lines.entries()) {
    await createAssignment(contract.id, { kpiId: assignment.kpiId, parentAssignmentId: assignment.id, weight: weights[index], ...values }, headActor);
  }
  await assignContract(contract.id, headActor);
  await signContract(contract.id, await actorFor(person, 'seed:demo'));
};

/**
 * In every office at the bottom: each count or amount goes to two of the three staff, a different pair each time, who
 * share it; the head takes the office's rates, stages and ratings on their own contract. Whatever nobody holds, the
 * head still types for the office.
 */
export const buildStaffContracts = async (year, offices, people, kpis, actors) => {
  const byId = new Map(kpis.map((kpi) => [kpi.id, kpi]));
  let count = 0;
  for (const office of Object.values(offices).filter((item) => item.isLeaf)) {
    const officeContract = await prisma.performanceContract.findFirst({ where: { fiscalYearId: year.id, officeId: office.id, personId: null } });
    const assignments = await prisma.kpiAssignment.findMany({
      where: { contractId: officeContract.id, status: 'ACKNOWLEDGED' },
      include: { baselines: { where: { isCurrent: true } }, targets: { where: { isCurrent: true } } },
      orderBy: { kpi: { name: 'asc' } },
    });
    const amounts = assignments.filter((assignment) => isAmount(byId.get(assignment.kpiId)) && !byId.get(assignment.kpiId).single);
    const others = assignments.filter((assignment) => !amounts.includes(assignment));

    const staff = people.staff.filter((item) => item.office.key === office.key);
    const holding = staff.map((_, n) => amounts.filter((__, index) => index % 3 !== n).slice(0, 5));
    // Each holder's part, by assignment, in the order the holders come
    const parts = new Map(amounts.map((assignment) => [assignment.id, partsOf(byId.get(assignment.kpiId), assignment, Math.max(1, holding.filter((mine) => mine.includes(assignment)).length))]));
    for (const [n, person] of staff.entries()) {
      const lines = holding[n].map((assignment) => ({ assignment, values: parts.get(assignment.id)[holding.slice(0, n).filter((mine) => mine.includes(assignment)).length] }));
      if (lines.length === 0) continue;
      await giveStaffContract(year, office, person, lines, actors[office.key]);
      count++;
    }
    const headsOwn = others.slice(0, 3);
    if (headsOwn.length > 0) {
      await giveStaffContract(year, office, people.heads[office.key], headsOwn.map((assignment) => ({ assignment, values: sameAsOffice(assignment) })), actors[office.key]);
      count++;
    }
  }
  return count;
};
