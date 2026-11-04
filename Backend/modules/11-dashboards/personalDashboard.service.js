import { prisma } from '../../config/database.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { parseUuid } from '../../utils/validation.js';
import { loadBands, loadPersonalContracts, publicView, resolveView, toSnapshot } from './dashboard.data.js';
import { summarize } from './dashboard.rules.js';
import { buildDeadlines, loadReports, withPlan } from './officeDashboard.service.js';

/**
 * Module 11 — A person's own dashboard: their staff contract's score, KPIs, trend, what is due and the feedback of
 * whoever reviews them. Nobody else's figures appear here, not even their office's.
 */

export const getMyDashboard = async ({ contractId, ...query } = {}, actor) => {
  const view = await resolveView(query);
  const [contracts, bands] = await Promise.all([loadPersonalContracts(view.fiscalYear.id, actor.personId), loadBands()]);
  const chosen = contractId ? parseUuid(contractId, 'contractId') : null;
  const contract = contracts.find((item) => item.id === chosen) ?? contracts[0] ?? null;

  const empty = {
    ...publicView(view),
    bands,
    contracts: contracts.map((item) => ({ id: item.id, office: item.office, status: item.status })),
    contractId: null,
    person: null,
    office: null,
    contractStatus: null,
    score: null,
    summary: summarize([]),
    kpis: [],
    trend: [],
    deadlines: [],
    feedback: [],
  };
  if (!contract) return empty;

  const snapshot = toSnapshot(contract, view.fiscalYear, view.period);
  const [periods, reports] = await Promise.all([
    prisma.reportingPeriod.findMany({ where: { fiscalYearId: view.fiscalYear.id, isClosed: false, ...(view.period ? { id: view.period.id } : {}) }, orderBy: { endDate: 'asc' } }),
    loadReports(contract.id, view.period),
  ]);

  return {
    ...empty,
    contractId: contract.id,
    person: contract.person,
    office: contract.office,
    contractStatus: contract.status,
    score: snapshot.score,
    summary: snapshot.summary,
    kpis: snapshot.lines.map(withPlan),
    trend: snapshot.trend,
    deadlines: buildDeadlines(contract, periods, startOfTodayUtc()),
    feedback: reports
      .flatMap((report) => report.reviews.map((review) => ({ ...review, reportId: report.id, reportingPeriod: report.reportingPeriod })))
      .sort((a, b) => b.reviewedAt - a.reviewedAt),
  };
};

export default { getMyDashboard };
