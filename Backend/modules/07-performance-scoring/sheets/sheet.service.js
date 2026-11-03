import { prisma } from '../../../config/database.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { startOfTodayUtc } from '../../../utils/dates.js';
import { notFound } from '../../../utils/httpError.js';
import { parseUuid } from '../../../utils/validation.js';
import { APPROVED_STATUSES, PERSON_REF, isOwnStaffContract, worksOnContract } from '../../05-contract-cascading/contract.shared.js';
import { toNumber } from '../../05-contract-cascading/measurement.js';
import { ownOfficeIdsOf, reviewsContract } from '../reports/report.access.js';
import { deadlineState } from '../reports/report.service.js';
import { EDITABLE_STATUSES } from '../reports/reportValue.service.js';
import { rollUpPeriods } from '../rules/aggregation.rules.js';
import { previewLines } from '../scoring/scoring.service.js';
import { LINE_INCLUDE, resolveResult, toResult } from '../scoring/result.service.js';

/**
 * Module 07 — The two year views of an office's performance:
 *  - the performance sheet, where results are entered each period: one section per reporting frequency, one column
 *    per period, the open period editable;
 *  - the year report, read only: approved results added up for the year, one column per office below plus the
 *    office's own work.
 * Both are read from the reports themselves; nothing is stored here.
 * Either one opens an office's contract, or with contractId a staff contract, for its person and their reviewer.
 */

const SIGNED = ['SIGNED', 'APPROVED'];
const OFFICE_REF = { select: { id: true, name: true, code: true } };
const SHEET_INCLUDE = { ...LINE_INCLUDE, reportingFrequency: true, kpi: { include: { ...LINE_INCLUDE.kpi.include, theme: { include: { parent: true } } } } };
const REPORT_INCLUDE = {
  contract: { select: { id: true, officeId: true, assigningOfficeId: true, fiscalYearId: true } },
  reportingPeriod: { include: { fiscalYear: true } },
};

const themeOf = (kpi) => {
  const theme = kpi.theme;
  if (!theme) return { theme: null, subTheme: null };
  const ref = (row) => ({ id: row.id, name: row.name, sortOrder: row.sortOrder });
  return theme.parent ? { theme: ref(theme.parent), subTheme: ref(theme) } : { theme: ref(theme), subTheme: null };
};

const kpiOf = (kpi) => ({
  id: kpi.id,
  name: kpi.name,
  measurementType: kpi.measurementType,
  direction: kpi.direction,
  unit: kpi.unit,
  currency: kpi.currency,
  remark: kpi.remark,
  levels: kpi.scale?.levels.map(({ id, name }) => ({ id, name })) ?? [],
});

const rowOf = (assignment) => ({
  assignmentId: assignment.id,
  kpi: kpiOf(assignment.kpi),
  ...themeOf(assignment.kpi),
  weight: toNumber(assignment.weights[0]?.weight),
  baseline: assignment.baselines[0] ?? null,
  target: assignment.targets[0] ?? null,
  frequencyId: assignment.reportingFrequencyId,
  hasOfficesBelow: assignment.children.length > 0,
  heldByStaff: assignment.staffParts.length > 0,
  kept: assignment.allocationsGiven.reduce((sum, row) => sum + (toNumber(row.allocatedAmount) ?? 0), 0),
});

/**
 * Whether the person may look at an office's performance: with a report permission that reaches it. Working in the
 * office is not enough, because staff see only their own staff contract.
 */
const readsOffice = async (actor, officeId) =>
  (await actor.access.can(PERMISSIONS.REPORT_READ, officeId)) || (await actor.access.can(PERMISSIONS.REPORT_REVIEW, officeId)) || actor.access.can(PERMISSIONS.REPORT_CREATE, officeId);

const assertCanRead = async (actor, officeId) => {
  if (!(await readsOffice(actor, officeId))) throw notFound('Office not found');
};

const CONTRACT_INCLUDE = { office: OFFICE_REF, assigningOffice: OFFICE_REF, person: PERSON_REF, fiscalYear: true };

const assignmentsOf = async (contract) => {
  if (!contract) return { contract: null, assignments: [] };
  const assignments = await prisma.kpiAssignment.findMany({
    where: { contractId: contract.id, status: { in: APPROVED_STATUSES } },
    include: SHEET_INCLUDE,
    orderBy: { kpi: { name: 'asc' } },
  });
  return { contract, assignments };
};

/**
 * The signed contract a sheet shows: a staff contract by its id, for its person and whoever reviews it, or an office's
 * own contract for the year.
 */
const openContract = async ({ fiscalYearId, officeId, contractId }, actor) => {
  if (contractId) {
    const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(contractId, 'contractId') }, include: CONTRACT_INCLUDE });
    const allowed = contract?.personId && SIGNED.includes(contract.status) && (isOwnStaffContract(actor, contract) || actor.access.canGlobally(PERMISSIONS.REPORT_READ) || (await reviewsContract(actor, PERMISSIONS.REPORT_REVIEW, contract)));
    if (!allowed) throw notFound('Contract not found');
    return assignmentsOf(contract);
  }
  const office = parseUuid(officeId, 'officeId');
  await assertCanRead(actor, office);
  return assignmentsOf(await prisma.performanceContract.findFirst({ where: { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId'), officeId: office, personId: null, status: { in: SIGNED } }, include: CONTRACT_INCLUDE }));
};

const contractRef = (contract) => ({
  id: contract.id,
  office: contract.office,
  assigningOffice: contract.assigningOffice,
  person: contract.person,
  fiscalYear: { id: contract.fiscalYear.id, name: contract.fiscalYear.name, status: contract.fiscalYear.status },
});

// ===== Offices the person can open =====

/**
 * Offices with a signed contract in the year that the person may look at, their own first.
 */
export const listPerformanceOffices = async ({ fiscalYearId } = {}, actor) => {
  const contracts = await prisma.performanceContract.findMany({
    where: { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId'), personId: null, status: { in: SIGNED } },
    select: { officeId: true, office: OFFICE_REF, assigningOfficeId: true },
    orderBy: { office: { name: 'asc' } },
  });
  const own = await ownOfficeIdsOf(actor);
  const visible = [];
  for (const contract of contracts) {
    if (await readsOffice(actor, contract.officeId)) visible.push({ ...contract.office, isOwn: own.has(contract.officeId) });
  }
  return visible.sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
};

// ===== The performance sheet =====

// The office's own figure: typed, or for a KPI its people hold, their approved results added up
const directOf = (resolved, directRow) => {
  if (resolved.fromStaff) return { reportingStatus: resolved.direct ? 'REPORTED' : 'NOT_REPORTED', value: null, numerator: null, denominator: null, scaleLevelId: null, ...resolved.direct, note: null };
  return directRow ? { reportingStatus: directRow.reportingStatus, value: directRow.value, numerator: directRow.numerator, denominator: directRow.denominator, scaleLevelId: directRow.scaleLevelId, note: directRow.note } : null;
};

const cellOf = (resolved, directRow, evidence) => ({
  valueId: directRow?.id ?? null,
  direct: directOf(resolved, directRow),
  fromStaff: Boolean(resolved.fromStaff),
  staff: (resolved.staff ?? []).map(({ person, result }) => ({ person, result })),
  fromBelow: resolved.aggregated?.kind === 'VALUE' ? resolved.aggregated.result : null,
  offices: (resolved.children ?? []).map(({ office, result }) => ({ office, result })),
  total: resolved.total,
  needsOwnFigure: resolved.needsOwnFigure,
  evidence: evidence.filter((item) => directRow && item.performanceValueId === directRow.id),
});

const periodActions = async (actor, contract, period, report) => {
  const today = startOfTodayUtc();
  const hasStarted = period.startDate <= today;
  const editable = contract.fiscalYear.status !== 'CLOSED' && !period.isClosed && hasStarted && (!report || EDITABLE_STATUSES.includes(report.status));
  const deadline = await deadlineState(period, report, today);
  return {
    hasStarted,
    deadline,
    edit: editable && (await worksOnContract(actor, PERMISSIONS.REPORT_CREATE, contract)),
    submit: editable && !deadline.isLocked && (await worksOnContract(actor, PERMISSIONS.REPORT_SUBMIT, contract)),
    allowLate: editable && deadline.isLate && actor.access.isSuperAdmin,
    attachEvidence: editable && (await worksOnContract(actor, PERMISSIONS.EVIDENCE_LINK, contract)),
  };
};

/**
 * One office's performance for a year, laid out for entering it: a section per reporting frequency, a column per
 * period. The open period is the earliest one that has started and can still be edited.
 */
export const getPerformanceSheet = async ({ fiscalYearId, officeId, contractId } = {}, actor) => {
  const { contract, assignments } = await openContract({ fiscalYearId, officeId, contractId }, actor);
  if (!contract) return { contract: null, sections: [] };
  const yearId = contract.fiscalYearId;

  const frequencyIds = [...new Set(assignments.map((assignment) => assignment.reportingFrequencyId))];
  const [periods, reports] = await Promise.all([
    prisma.reportingPeriod.findMany({ where: { fiscalYearId: yearId, frequencyId: { in: frequencyIds } }, include: { frequency: true, fiscalYear: true }, orderBy: [{ startDate: 'asc' }, { name: 'asc' }] }),
    prisma.performanceReport.findMany({ where: { contractId: contract.id }, include: REPORT_INCLUDE }),
  ]);

  const sections = [];
  for (const frequencyId of frequencyIds) {
    const own = assignments.filter((assignment) => assignment.reportingFrequencyId === frequencyId);
    const sectionPeriods = periods.filter((period) => period.frequencyId === frequencyId);
    const columns = [];
    const cells = new Map(own.map((assignment) => [assignment.id, {}]));

    for (const period of sectionPeriods) {
      const report = reports.find((candidate) => candidate.reportingPeriodId === period.id) ?? null;
      if (report) {
        const lines = await previewLines(report);
        const valueIds = lines.map((line) => line.directRow?.id).filter(Boolean);
        const evidence = await prisma.performanceEvidence.findMany({
          where: { performanceValueId: { in: valueIds } },
          select: { id: true, performanceValueId: true, verificationStatus: true, comment: true, document: { select: { id: true, title: true, fileId: true, createdAt: true } } },
          orderBy: { createdAt: 'asc' },
        });
        for (const line of lines) {
          const row = cells.get(line.assignment.id);
          if (row) row[period.id] = cellOf(line.resolved, line.directRow, evidence);
        }
      } else {
        for (const assignment of own) cells.get(assignment.id)[period.id] = cellOf(await resolveResult(assignment, period, null), null, []);
      }
      columns.push({
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        submissionDeadline: period.submissionDeadline,
        isClosed: period.isClosed,
        report: report ? { id: report.id, status: report.status, isLate: report.isLate, lateAllowedUntil: report.lateAllowedUntil, lateAllowedReason: report.lateAllowedReason } : null,
        can: await periodActions(actor, contract, period, report),
      });
    }

    // Periods are entered in order: the open one is the earliest that can still be edited
    const open = columns.find((column) => column.can.edit || column.can.submit || column.can.allowLate);
    sections.push({
      frequency: { id: frequencyId, name: own[0].reportingFrequency.name, intervalMonths: own[0].reportingFrequency.intervalMonths },
      openPeriodId: open?.id ?? null,
      periods: columns,
      rows: own.map((assignment) => ({ ...rowOf(assignment), cells: cells.get(assignment.id) })),
    });
  }
  // The order the university reads them in: quarterly, monthly, semi-annual, annual
  const ORDER = { 3: 0, 1: 1, 6: 2, 12: 3 };
  sections.sort((a, b) => (ORDER[a.frequency.intervalMonths] ?? 9) - (ORDER[b.frequency.intervalMonths] ?? 9));
  return { contract: contractRef(contract), sections };
};

// ===== The year report =====

/**
 * Approved rows of one assignment over the year, of one contribution type, earliest first.
 */
const approvedRows = (assignmentId, contributionType, year) =>
  prisma.performanceValue.findMany({
    where: { assignmentId, contributionType, report: { status: 'APPROVED', reportingPeriod: { fiscalYearId: year.id } } },
    include: { report: { select: { reportingPeriod: { select: { endDate: true, frequencyId: true } } } } },
  });

/**
 * Approved results added up over the year, each KPI the way it rolls up. Only the assignment's own frequency counts,
 * so a quarter is never added to the months inside it.
 */
const yearToDate = async (assignmentId, frequencyId, kpi, contributionType, year) => {
  const rows = (await approvedRows(assignmentId, contributionType, year)).filter((row) => row.report.reportingPeriod.frequencyId === frequencyId);
  return rollUpPeriods(kpi, rows.sort((a, b) => a.report.reportingPeriod.endDate - b.report.reportingPeriod.endDate).map(toResult));
};

/**
 * An office's results for the year so far, approved only: one column per office below that holds a KPI, one for
 * the office's own work where it does some, and the total.
 */
export const getYearReport = async ({ fiscalYearId, officeId, contractId } = {}, actor) => {
  const { contract, assignments } = await openContract({ fiscalYearId, officeId, contractId }, actor);
  if (!contract) return { contract: null, columns: [], rows: [] };
  const year = contract.fiscalYear;

  const below = new Map();
  for (const assignment of assignments) for (const child of assignment.children) below.set(child.contract.office.id, child.contract.office);
  const ownKey = 'OWN';

  const rows = [];
  let hasOwnWork = false;
  for (const assignment of assignments) {
    const { kpi } = assignment;
    const cells = {};
    for (const child of assignment.children) cells[child.contract.office.id] = await yearToDate(child.id, child.reportingFrequencyId, kpi, 'TOTAL', year);

    const kept = assignment.allocationsGiven.some((row) => toNumber(row.allocatedAmount) > 0);
    const doesOwnWork = assignment.children.length === 0 || kept;
    if (doesOwnWork) {
      hasOwnWork = true;
      cells[ownKey] = await yearToDate(assignment.id, assignment.reportingFrequencyId, kpi, 'DIRECT', year);
    }
    const notes = (await approvedRows(assignment.id, 'DIRECT', year)).filter((row) => row.note).sort((a, b) => b.report.reportingPeriod.endDate - a.report.reportingPeriod.endDate);
    rows.push({
      ...rowOf(assignment),
      cells,
      total: await yearToDate(assignment.id, assignment.reportingFrequencyId, kpi, 'TOTAL', year),
      remark: notes[0]?.note ?? null,
    });
  }

  const columns = [...below.values()].sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ key: item.id, label: item.name }));
  // A bottom office's own column carries its name; a parent's says it is its own work
  if (hasOwnWork) columns.push({ key: ownKey, label: below.size > 0 ? `${contract.office.name} (own)` : contract.office.name, isOwn: true });
  return { contract: contractRef(contract), columns, showTotal: columns.length > 1, rows };
};

export default { listPerformanceOffices, getPerformanceSheet, getYearReport };
