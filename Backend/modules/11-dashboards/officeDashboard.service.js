import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { requiredImprovement } from '../05-contract-cascading/measurement.js';
import { holdsOnThisOffice } from '../07-performance-scoring/reports/report.access.js';
import { assertCanView, findOffice, formatMeasured, loadContracts, loadYearHistory, publicLine, publicView, resolveView, toSnapshot } from './dashboard.data.js';
import { countEvidence, isDue, isOverdue, resultState, summarize } from './dashboard.rules.js';

/**
 * Module 11 — An office's own dashboard (SRS 12.3): what it was given, how it is doing, what is due, its evidence,
 * the feedback it received and its history. An office above sees the same page, without evidence on drafts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DRAFT_STATUSES = ['NOT_STARTED', 'DRAFT'];

const withPlan = (line) => {
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

const buildDeadlines = (contract, periods, today) => {
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

const loadReports = (contractId, period) =>
  prisma.performanceReport.findMany({
    where: { contractId, ...(period ? { reportingPeriodId: period.id } : {}) },
    select: {
      id: true,
      status: true,
      reportingPeriod: { select: { id: true, name: true, endDate: true } },
      values: { where: { contributionType: 'DIRECT' }, select: { reportingStatus: true, evidence: { select: { verificationStatus: true } } } },
      reviews: { select: { id: true, decision: true, comment: true, reviewedAt: true, reviewerOffice: { select: { id: true, name: true } } } },
    },
    orderBy: { reportingPeriod: { endDate: 'asc' } },
  });

export const getOfficeDashboard = async (officeId, query, actor) => {
  const office = await findOffice(officeId);
  await assertCanView(actor, office.id);

  const view = await resolveView(query);
  const [[contract], history] = await Promise.all([loadContracts(view.fiscalYear.id, [office.id]), loadYearHistory(office.id)]);
  const empty = { ...publicView(view), office, contractStatus: null, score: null, summary: summarize([]), kpis: [], trend: [], deadlines: [], evidence: [], feedback: [], history };
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

export default { getOfficeDashboard };
