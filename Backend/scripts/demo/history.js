import { prisma } from '../../config/database.js';
import { parseMeasuredValue } from '../../modules/05-contract-cascading/measurement.js';
import { recalculateReport } from '../../modules/07-performance-scoring/scoring/scoring.service.js';
import { dueAssignments, isDirectEntry } from '../../modules/07-performance-scoring/scoring/result.service.js';

/**
 * A whole year already reported and approved, as if every office and person had done it on time, period by period:
 * the offices and people at the bottom type their results, each is approved by the one above, and the system adds
 * them up the hierarchy and over the year, exactly as it does on approval in the screens.
 * The reports are written straight to the database, because the deadlines are long past; every figure built on them
 * is then calculated by the real scoring.
 */

const DAY = 86400000;

// ===== Figures that look real, the same on every run =====

const hash = (text) => [...text].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) | 0, 7);

/**
 * A number from 0 to 1 that depends only on the text, so a run of the seed always gives the same results.
 */
const chance = (text) => {
  let value = hash(text) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const between = (text, low, high) => low + chance(text) * (high - low);
const roundTo = (value, step) => Math.round(value / step) * step;
const numberOf = (value) => (value === null || value === undefined ? null : Number(value));

/**
 * One period's own figure for a KPI. `progress` runs from just above 0 to 1 over the year. `form` is how well this
 * office or person does overall, so some do better than others.
 */
const figureFor = (assignment, period, progress, form) => {
  const { kpi } = assignment;
  const baseline = assignment.baselines[0];
  const target = assignment.targets[0];
  const key = `${assignment.id}:${period.id}`;
  const lower = kpi.direction === 'LOWER_IS_BETTER';
  // How far from the baseline towards the target this period gets: below 1 falls short, above 1 beats it
  const reach = Math.max(0, progress * form * between(key, 0.85, 1.15));

  if (kpi.measurementType === 'STAGE' || kpi.measurementType === 'CATEGORY') {
    const levels = kpi.scale.levels;
    const from = levels.findIndex((level) => level.id === baseline.scaleLevelId);
    const to = levels.findIndex((level) => level.id === target.scaleLevelId);
    const index = Math.min(levels.length - 1, Math.max(0, Math.round(from + (to - from) * Math.min(reach, 1.1))));
    return { scaleLevelId: levels[index].id };
  }

  if (kpi.measurementType === 'PERCENTAGE' || kpi.measurementType === 'RATIO') {
    const scale = kpi.measurementType === 'PERCENTAGE' ? 100 : 1;
    const startRate = numberOf(baseline.numerator) !== null ? numberOf(baseline.numerator) / numberOf(baseline.denominator) : numberOf(baseline.value) / scale;
    const wantedRate = numberOf(target.value) / scale;
    const rate = Math.max(0, startRate + (wantedRate - startRate) * Math.min(reach, 1.2));
    const denominator = Math.max(4, Math.round((numberOf(baseline.denominator) ?? 100) * between(`${key}:d`, 0.9, 1.1)));
    return { numerator: Math.round(rate * denominator), denominator };
  }

  // Counts and amounts
  const step = kpi.measurementType === 'MONEY' ? 1000 : 1;
  const goal = numberOf(target.value);
  if (kpi.periodRollupMethod === 'SUM') {
    // Each period adds its part of the year's target: more is better, or for a count to keep down, less. An office
    // that gave most of the target to the offices below works only towards the part it kept.
    const part = (assignment.kept > 0 ? assignment.kept : goal) / assignment.periodCount;
    return { value: Math.max(0, roundTo(part * (lower ? 2 - form : form) * between(key, 0.8, 1.2), step)) };
  }
  // A level that moves from the baseline towards the target, such as enrolment or average days
  const start = numberOf(baseline.value);
  const value = start + (goal - start) * Math.min(reach, 1.15);
  return { value: Math.max(0, roundTo(value, step)) };
};

// ===== Reporting =====

/**
 * Whether an office types its own figure for a KPI: an office at the bottom, a person, or an office that kept part
 * of the target for itself, unless its people hold the KPI, whose results make it up. The rest comes from below.
 */
const keptBy = (assignment) => assignment.allocationsGiven.reduce((sum, row) => sum + Number(row.allocatedAmount), 0);
const typesOwnFigure = (assignment) => assignment.staffParts.length === 0 && (assignment.children.length === 0 || keptBy(assignment) > 0);

/**
 * Who reports a contract and who approves it: the office's head and the head above, or the person and the head of
 * their office. A head's own work goes to the head above; the President's self contract to the Super Admin.
 */
const rolesFor = (contract, people, officesById) => {
  const office = officesById.get(contract.officeId);
  const headOf = (officeId) => people.heads[officesById.get(officeId).key];
  if (!contract.personId) return { preparer: headOf(contract.officeId), reviewer: contract.assigningOfficeId ? headOf(contract.assigningOfficeId) : people.admin, reviewerOfficeId: contract.assigningOfficeId };
  const isHead = headOf(contract.officeId).id === contract.personId;
  if (isHead) return { preparer: headOf(contract.officeId), reviewer: headOf(office.parentOfficeId), reviewerOfficeId: office.parentOfficeId };
  return { preparer: { id: contract.personId }, reviewer: headOf(contract.officeId), reviewerOfficeId: contract.officeId };
};

/**
 * Report and approve every period of a year for every contract, bottom up. Periods go in order of their end, and
 * the shorter one first when several end together, so the months and quarters are in before the year end needs them.
 */
export const buildHistory = async (year, people, offices, adminActor) => {
  const officesById = new Map(Object.values(offices).map((office) => [office.id, office]));
  const depth = (officeId) => (officesById.get(officeId).parentOfficeId ? 1 + depth(officesById.get(officeId).parentOfficeId) : 0);

  const contracts = await prisma.performanceContract.findMany({ where: { fiscalYearId: year.id, status: 'SIGNED' } });
  // People first, then offices from the bottom up, so each office's figures are approved before the office above
  const ordered = contracts.sort((a, b) => Number(Boolean(b.personId)) - Number(Boolean(a.personId)) || depth(b.officeId) - depth(a.officeId));

  const periods = await prisma.reportingPeriod.findMany({ where: { fiscalYearId: year.id }, include: { frequency: true, fiscalYear: true } });
  periods.sort((a, b) => a.endDate - b.endDate || (a.frequency.intervalMonths ?? 99) - (b.frequency.intervalMonths ?? 99));
  const countOf = (frequencyId) => periods.filter((period) => period.frequencyId === frequencyId).length;
  const indexOf = (period) => periods.filter((other) => other.frequencyId === period.frequencyId && other.endDate <= period.endDate).length;

  const currency = await prisma.currency.findFirst({ where: { code: 'ETB' } });
  let reports = 0;
  for (const period of periods) {
    for (const contract of ordered) {
      const due = await dueAssignments(contract.id, period);
      if (due.length === 0) continue;
      const { preparer, reviewer, reviewerOfficeId } = rolesFor(contract, people, officesById);

      // Mostly on time, now and then a few days late
      const deadline = period.submissionDeadline ?? new Date(period.endDate.getTime() + 10 * DAY);
      const lateDays = chance(`${contract.id}:${period.id}:late`) < 0.06 ? Math.ceil(between(`${contract.id}:${period.id}:days`, 1, 6)) : 0;
      const submittedAt = new Date(deadline.getTime() + (lateDays > 0 ? lateDays : -Math.ceil(between(`${contract.id}:${period.id}:early`, 1, 5))) * DAY);
      const report = await prisma.performanceReport.create({
        data: { contractId: contract.id, reportingPeriodId: period.id, status: 'DRAFT', preparedByPersonId: preparer.id, createdAt: new Date(submittedAt.getTime() - 3 * DAY) },
      });

      const form = between(`${contract.id}:form`, 0.82, 1.08);
      for (const assignment of due.filter((item) => isDirectEntry(item, period) && typesOwnFigure(item))) {
        const periodCount = countOf(assignment.reportingFrequencyId);
        const figure = figureFor({ ...assignment, periodCount, kept: keptBy(assignment) }, period, indexOf(period) / periodCount, form);
        // Stored exactly as a result typed on the screen is: a percentage keeps its parts and its value
        const columns = parseMeasuredValue(assignment.kpi, figure, 'result', { requireParts: true });
        const money = assignment.kpi.measurementType === 'MONEY' ? { currencyId: currency.id, convertedValue: columns.value } : {};
        await prisma.performanceValue.create({ data: { reportId: report.id, assignmentId: assignment.id, contributionType: 'DIRECT', reportingStatus: 'REPORTED', ...columns, ...money, enteredByPersonId: preparer.id } });
      }

      const reviewedAt = new Date(submittedAt.getTime() + Math.ceil(between(`${contract.id}:${period.id}:review`, 1, 4)) * DAY);
      await prisma.performanceReport.update({ where: { id: report.id }, data: { status: 'APPROVED', submittedByPersonId: preparer.id, submittedAt, isLate: lateDays > 0 } });
      await prisma.performanceReview.create({ data: { reportId: report.id, reviewerPersonId: reviewer.id, reviewerOfficeId, decision: 'APPROVED', reviewedAt } });
      await recalculateReport(report.id, adminActor);
      reports++;
    }
    process.stdout.write(`\r📈 Reported and approved ${reports} reports (up to ${period.name})          `);
  }
  process.stdout.write('\n');
  return reports;
};
