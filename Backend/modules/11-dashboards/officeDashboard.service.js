import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { requiredImprovement } from '../05-contract-cascading/measurement.js';
import { holdsOnThisOffice } from '../07-performance-scoring/reports/report.access.js';
import { assertCanView, findOffice, formatMeasured, loadBands, loadContracts, loadStaffContracts, loadYearHistory, publicLine, publicView, resolveView, toSnapshot } from './dashboard.data.js';
import { countEvidence, isDue, isOverdue, pickCurrent, resultState, summarize } from './dashboard.rules.js';

/**
 * Module 11 — An office's own dashboard (SRS 12.3): what it was given, how it is doing, what is due, its evidence,
 * the feedback it received and its history. An office above sees the same page, without evidence on drafts.
 * Whoever reviews the office's staff also sees each staff contract's score side by side.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DRAFT_STATUSES = ['NOT_STARTED', 'DRAFT'];

export const withPlan = (line) => {
  const { kpi } = line.assignment;
  const baseline = line.assignment.baselines[0];
  const target = line.assignment.targets[0];
  return {
    ...publicLine(line),
    baseline: baseline ? { ...formatMeasured(baseline), baselineStatus: baseline.baselineStatus } : null,
    target: formatMeasured(target),
    requiredImprovement: requiredImprovement(kpi, baseline, target),
  };
};

export const buildDeadlines = (contract, periods, today) => {
  const statusIn = new Map(contract.reports.map((report) => [report.reportingPeriodId, report.status]));
  return periods
    .filter((period) => contract.assignments.some((assignment) => isDue(assignment, period)))
    .map((period) => ({
      reportingPeriod: period,
      daysLeft: period.submissionDeadline ? Math.round((period.submissionDeadline - today) / DAY_MS) : null,
      state: resultState(statusIn.get(period.id)),
      isOverdue: isOverdue(period, statusIn.get(period.id), today),
    }));
};

export const loadReports = (contractId, period) =>
  prisma.performanceReport.findMany({
    where: { contractId, ...(period ? { reportingPeriodId: period.id } : {}) },
    select: {
      id: true,
      status: true,
      reportingPeriod: { select: { id: true, name: true, endDate: true } },
      values: { where: { contributionType: 'DIRECT' }, select: { reportingStatus: true, evidence: { select: { verificationStatus: true } } } },
      reviews: { select: { id: true, decision: true, comment: true, reviewedAt: true, reviewer: { select: { id: true, firstName: true, lastName: true } }, reviewerOffice: { select: { id: true, name: true } } } },
    },
    orderBy: { reportingPeriod: { endDate: 'asc' } },
  });

/**
 * Each staff contract of the office side by side, best score first, for those who review the office's staff or see
 * the offices below. Scores are compared, never averaged.
 */
const loadStaffRows = async (office, view, actor) => {
  const seesStaff = actor.access.isSuperAdmin || holdsOnThisOffice(actor, PERMISSIONS.REPORT_REVIEW, office.id) || (await actor.access.reaches(PERMISSIONS.DASHBOARD_READ_ALL, office.id));
  if (!seesStaff) return [];
  const contracts = await loadStaffContracts(view.fiscalYear.id, office.id);
  const rows = contracts.map((contract) => {
    const snapshot = toSnapshot(contract, view.fiscalYear, view.period);
    const latest = pickCurrent(contract.reports.filter((report) => resultState(report.status) !== 'MISSING'));
    return {
      person: contract.person,
      contractId: contract.id,
      contractStatus: contract.status,
      score: snapshot.score,
      summary: snapshot.summary,
      latestReport: latest ? { reportId: latest.id, reportingPeriod: latest.reportingPeriod, state: resultState(latest.status) } : null,
    };
  });
  // Best official score first; anyone without one yet comes last rather than counting as zero
  const scoreOf = (row) => row.score?.officialScore ?? null;
  return rows.sort((a, b) => (scoreOf(a) === null) - (scoreOf(b) === null) || (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0) || a.person.firstName.localeCompare(b.person.firstName));
};

export const getOfficeDashboard = async (officeId, query, actor) => {
  const office = await findOffice(officeId);
  await assertCanView(actor, office.id);

  const view = await resolveView(query);
  const [[contract], history, bands, staff] = await Promise.all([loadContracts(view.fiscalYear.id, [office.id]), loadYearHistory(office.id), loadBands(), loadStaffRows(office, view, actor)]);
  const empty = { ...publicView(view), bands, office, contractStatus: null, score: null, summary: summarize([]), kpis: [], trend: [], deadlines: [], evidence: [], feedback: [], history, staff };
  if (!contract) return empty;

  const snapshot = toSnapshot(contract, view.fiscalYear, view.period);
  const [periods, reports] = await Promise.all([
    prisma.reportingPeriod.findMany({ where: { fiscalYearId: view.fiscalYear.id, isClosed: false, ...(view.period ? { id: view.period.id } : {}) }, orderBy: { endDate: 'asc' } }),
    loadReports(contract.id, view.period),
  ]);

  const seesDrafts = actor.access.canGlobally(PERMISSIONS.DASHBOARD_READ) || holdsOnThisOffice(actor, PERMISSIONS.DASHBOARD_READ, office.id);
  const evidenceReports = seesDrafts ? reports : reports.filter((report) => !DRAFT_STATUSES.includes(report.status));

  return {
    ...empty,
    contractStatus: contract.status,
    score: snapshot.score,
    summary: snapshot.summary,
    kpis: snapshot.lines.map(withPlan),
    trend: snapshot.trend,
    deadlines: buildDeadlines(contract, periods, startOfTodayUtc()),
    evidence: evidenceReports.map((report) => ({ reportId: report.id, reportingPeriod: report.reportingPeriod, ...countEvidence(report.values) })),
    feedback: reports
      .flatMap((report) => report.reviews.map((review) => ({ ...review, reportId: report.id, reportingPeriod: report.reportingPeriod })))
      .sort((a, b) => b.reviewedAt - a.reviewedAt),
  };
};

export default { getOfficeDashboard, withPlan, buildDeadlines, loadReports };
