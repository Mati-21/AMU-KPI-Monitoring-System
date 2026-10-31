import { prisma } from '../../config/database.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { requiredImprovement, toNumber } from '../05-contract-cascading/measurement.js';
import { OFFICE_REF, assertCanView, findOffice, formatMeasured, loadContracts, publicLine, publicView, resolveView, toOfficeRow, toSnapshot } from './dashboard.data.js';
import { compareOffices, isDue, isOverdue, isSubmitted, resultState, summarize } from './dashboard.rules.js';

/**
 * Module 11 — Parent office dashboard (SRS 12.2): the office's own KPIs, how its direct subordinates compare, how each
 * responsibility was split, and which reports are outstanding. A subordinate's draft figures are never shown here.
 */

const LIVE_CONTRACT = ['APPROVED', 'SIGNED'];
const AWAITING_REVIEW = ['SUBMITTED', 'UNDER_REVIEW'];

const sumAmounts = (allocations) => allocations.reduce((total, row) => total + toNumber(row.allocatedAmount), 0);

/**
 * How each of the office's KPIs was shared: what it kept, what it passed down, and to whom.
 */
const loadResponsibilities = async (lines) => {
  const parentIds = lines.map((line) => line.assignmentId);
  const [allocations, children] = await Promise.all([
    prisma.responsibilityAllocation.findMany({ where: { parentAssignmentId: { in: parentIds } } }),
    prisma.kpiAssignment.findMany({
      where: { parentAssignmentId: { in: parentIds }, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        parentAssignmentId: true,
        status: true,
        contract: { select: { office: { select: { id: true, name: true, code: true } } } },
        targets: { where: { isCurrent: true }, take: 1 },
        weights: { where: { isCurrent: true }, take: 1 },
      },
    }),
  ]);

  return lines.map(({ assignment, assignmentId, kpi }) => {
    const given = allocations.filter((row) => row.parentAssignmentId === assignmentId);
    return {
      assignmentId,
      kpi: { id: kpi.id, code: kpi.code, name: kpi.name },
      requiredImprovement: requiredImprovement(assignment.kpi, assignment.baselines[0], assignment.targets[0]),
      retained: sumAmounts(given.filter((row) => row.allocationType === 'RETAINED')),
      distributed: sumAmounts(given.filter((row) => row.allocationType === 'DISTRIBUTED')),
      reconciliationStatus: assignment.reconciliationStatus,
      subordinates: children
        .filter((child) => child.parentAssignmentId === assignmentId)
        .map((child) => ({
          assignmentId: child.id,
          office: child.contract.office,
          status: child.status,
          target: formatMeasured(child.targets[0]),
          weight: toNumber(child.weights[0]?.weight),
          allocated: toNumber(given.find((row) => row.childAssignmentId === child.id)?.allocatedAmount),
        })),
    };
  });
};

const awaitingReview = (snapshots, period) =>
  snapshots.flatMap(({ contract }) =>
    contract.reports
      .filter((report) => AWAITING_REVIEW.includes(report.status) && (!period || report.reportingPeriodId === period.id))
      .map((report) => ({ reportId: report.id, office: contract.office, reportingPeriod: report.reportingPeriod, status: report.status, submittedAt: report.submittedAt }))
  );

/**
 * Reports that should be in by now: a live contract, KPIs due in a period that has ended, nothing submitted.
 */
const pendingReports = (snapshots, periods, today) =>
  snapshots.flatMap(({ contract }) => {
    if (!LIVE_CONTRACT.includes(contract.status)) return [];
    const statusIn = new Map(contract.reports.map((report) => [report.reportingPeriodId, report.status]));
    return periods
      .filter((period) => period.endDate <= today && !isSubmitted(statusIn.get(period.id)) && contract.assignments.some((assignment) => isDue(assignment, period)))
      .map((period) => ({
        office: contract.office,
        reportingPeriod: period,
        state: resultState(statusIn.get(period.id)),
        isOverdue: isOverdue(period, statusIn.get(period.id), today),
      }));
  });

export const getParentOfficeDashboard = async (officeId, query, actor) => {
  const office = await findOffice(officeId);
  await assertCanView(actor, office.id);

  const view = await resolveView(query);
  const subordinates = await prisma.office.findMany({ where: { parentOfficeId: office.id, isActive: true }, ...OFFICE_REF });
  const contracts = await loadContracts(view.fiscalYear.id, [office.id, ...subordinates.map((row) => row.id)]);
  const snapshots = new Map(contracts.map((contract) => [contract.officeId, toSnapshot(contract, view.fiscalYear, view.period)]));
  const childSnapshots = subordinates.map((row) => snapshots.get(row.id)).filter(Boolean);
  const own = snapshots.get(office.id) ?? null;
  const periods = view.period ? [view.period] : await prisma.reportingPeriod.findMany({ where: { fiscalYearId: view.fiscalYear.id, isClosed: false }, orderBy: { endDate: 'asc' } });

  return {
    ...publicView(view),
    office,
    contractStatus: own?.contract.status ?? null,
    score: own?.score ?? null,
    summary: own?.summary ?? summarize([]),
    kpis: (own?.lines ?? []).map(publicLine),
    responsibilities: own ? await loadResponsibilities(own.lines) : [],
    subordinates: compareOffices(subordinates.map((row) => toOfficeRow(row, snapshots.get(row.id)))),
    reports: {
      awaitingReview: awaitingReview(childSnapshots, view.period),
      pending: pendingReports(childSnapshots, periods, startOfTodayUtc()),
    },
  };
};

export default { getParentOfficeDashboard };
