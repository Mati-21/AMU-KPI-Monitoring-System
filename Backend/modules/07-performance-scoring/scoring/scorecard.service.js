import { prisma } from '../../../config/database.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { forbidden, notFound } from '../../../utils/httpError.js';
import { parseUuid } from '../../../utils/validation.js';

/**
 * Module 07 — Reading saved results: scorecards, an assignment's performance, and a KPI's history across years.
 * A report's results are saved from submission on, so a parent office never sees another office's draft.
 */

const ACHIEVEMENT_INCLUDE = {
  reportingPeriod: { select: { id: true, name: true, startDate: true, endDate: true, isYearEnd: true } },
  statusThreshold: { select: { id: true, name: true, color: true } },
  actualScaleLevel: { select: { id: true, name: true } },
  baseline: { select: { id: true, versionNo: true, baselineStatus: true, value: true, numerator: true, denominator: true, scaleLevelId: true } },
  target: { select: { id: true, versionNo: true, value: true, numerator: true, denominator: true, scaleLevelId: true } },
  weight: { select: { id: true, versionNo: true, weight: true } },
};

const OFFICE_REF = { select: { id: true, name: true, code: true } };

const assertCanRead = async (actor, officeId) => {
  if (!(await actor.access.can(PERMISSIONS.SCORECARD_READ, officeId))) throw forbidden('You can see scorecards only for offices in your scope');
};

/**
 * One office's contract for a year: every score so far and its achievements, by period.
 * With reportingPeriodId, just that period.
 */
export const getOfficeScorecard = async (officeId, { fiscalYearId, reportingPeriodId } = {}, actor) => {
  const office = parseUuid(officeId, 'officeId');
  await assertCanRead(actor, office);

  const contract = await prisma.performanceContract.findFirst({
    where: { officeId: office, fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') },
    include: { office: OFFICE_REF, fiscalYear: { select: { id: true, name: true, status: true } } },
  });
  if (!contract) throw notFound('This office has no contract for that fiscal year');

  const periodFilter = reportingPeriodId ? { reportingPeriodId: parseUuid(reportingPeriodId, 'reportingPeriodId') } : {};
  const [scores, achievements] = await Promise.all([
    prisma.contractScore.findMany({
      where: { contractId: contract.id, ...periodFilter },
      include: { reportingPeriod: { select: { id: true, name: true, startDate: true, endDate: true, isYearEnd: true } } },
      orderBy: { reportingPeriod: { endDate: 'asc' } },
    }),
    prisma.kpiAchievement.findMany({
      where: { assignment: { contractId: contract.id }, ...periodFilter },
      include: { ...ACHIEVEMENT_INCLUDE, assignment: { select: { id: true, kpi: { select: { id: true, code: true, name: true, measurementType: true, direction: true, scoringMethod: true } } } } },
      orderBy: [{ reportingPeriod: { endDate: 'asc' } }, { assignment: { kpi: { code: 'asc' } } }],
    }),
  ]);
  return { contract, scores, achievements };
};

/**
 * One assignment across its periods, with the offices below it.
 */
export const getAssignmentPerformance = async (assignmentId, actor) => {
  const assignment = await prisma.kpiAssignment.findUnique({
    where: { id: parseUuid(assignmentId, 'id') },
    include: {
      kpi: { select: { id: true, code: true, name: true, measurementType: true, direction: true } },
      contract: { select: { officeId: true, office: OFFICE_REF } },
      achievements: { include: ACHIEVEMENT_INCLUDE, orderBy: { reportingPeriod: { endDate: 'asc' } } },
      children: {
        select: {
          id: true,
          status: true,
          contract: { select: { office: OFFICE_REF } },
          achievements: { include: ACHIEVEMENT_INCLUDE, orderBy: { reportingPeriod: { endDate: 'asc' } } },
        },
      },
    },
  });
  if (!assignment) throw notFound('Assignment not found');
  await assertCanRead(actor, assignment.contract.officeId);
  return assignment;
};

/**
 * A KPI's results year by year for one office. Use the top office for the whole university.
 * Follows replacesKpiId, so a KPI that was replaced keeps its trend. Newest year first.
 */
export const getKpiHistory = async (kpiId, { officeId } = {}, actor) => {
  const office = parseUuid(officeId, 'officeId');
  await assertCanRead(actor, office);

  const lineage = [];
  let current = await prisma.kpi.findUnique({ where: { id: parseUuid(kpiId, 'id') }, select: { id: true, code: true, name: true, replacesKpiId: true } });
  if (!current) throw notFound('KPI not found');
  while (current) {
    lineage.push(current);
    current = current.replacesKpiId ? await prisma.kpi.findUnique({ where: { id: current.replacesKpiId }, select: { id: true, code: true, name: true, replacesKpiId: true } }) : null;
  }

  const assignments = await prisma.kpiAssignment.findMany({
    where: { kpiId: { in: lineage.map((kpi) => kpi.id) }, contract: { officeId: office }, status: { in: ['APPROVED', 'ACKNOWLEDGED'] } },
    include: {
      kpi: { select: { id: true, code: true, name: true } },
      contract: { select: { fiscalYear: { select: { id: true, name: true, status: true, startDate: true } } } },
      achievements: { include: ACHIEVEMENT_INCLUDE, orderBy: { reportingPeriod: { endDate: 'desc' } } },
    },
  });

  const years = assignments
    .map((assignment) => ({
      fiscalYear: assignment.contract.fiscalYear,
      kpi: assignment.kpi,
      assignmentId: assignment.id,
      // The year-end result if there is one, otherwise the latest so far
      result: assignment.achievements.find((row) => row.reportingPeriod.isYearEnd) ?? assignment.achievements[0] ?? null,
    }))
    .sort((a, b) => b.fiscalYear.startDate - a.fiscalYear.startDate);
  return { lineage: lineage.map(({ replacesKpiId: _unused, ...kpi }) => kpi), years };
};

export default { getOfficeScorecard, getAssignmentPerformance, getKpiHistory };
