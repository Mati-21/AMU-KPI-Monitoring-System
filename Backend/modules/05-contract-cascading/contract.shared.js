import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { getSetting } from '../10-system-governance/system.service.js';
import { numericValue, requiredImprovement, toNumber } from './measurement.js';

/**
 * Module 05 — Who may act on a contract and how assignments are loaded and shown.
 * The office above sets a subordinate's baseline and target (SRS 4.3), so manage and approve authority is checked
 * on the assigning office. The top office has none, so its contract needs university-wide authority.
 */

export const LIVE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACKNOWLEDGED'];
export const APPROVED_STATUSES = ['APPROVED', 'ACKNOWLEDGED'];
// The contract is with the office above, which can still change it
export const OPEN_CONTRACT_STATUSES = ['DRAFT', 'REJECTED'];
const ASSIGNED_STATUSES = ['SUBMITTED', ...APPROVED_STATUSES];

// The office that gives the contract. The top office has none above it, so its own authority covers its self contract.
const authorityOfficeOf = (contract) => contract.assigningOfficeId ?? contract.officeId;

const hasAuthorityFromAbove = (actor, code, contract) => actor.access.can(code, authorityOfficeOf(contract));

export const assertAuthorityFromAbove = async (actor, code, contract) => {
  if (await hasAuthorityFromAbove(actor, code, contract)) return;
  const office = await prisma.office.findUnique({ where: { id: authorityOfficeOf(contract) }, select: { name: true } });
  throw forbidden(`You need ${code} authority over ${office?.name ?? 'the assigning office'}, which gives this contract. Check that your role has it and applies to that office`);
};

export const assertAuthorityOnOffice = async (actor, code, officeId) => {
  if (!(await actor.access.can(code, officeId))) throw forbidden(`You need ${code} authority over the receiving office`);
};

/**
 * Where the university requires it, the person who prepared something cannot also approve it.
 */
export const assertSeparateApprover = async (actor, preparedByPersonId) => {
  if (preparedByPersonId && preparedByPersonId === actor.personId && (await getSetting('kpi', 'require_separate_approver'))) {
    throw forbidden('The person who prepared this cannot also approve it');
  }
};

// The office that sent the contract, or the office itself for a self contract, which nobody sends
const readsFromAbove = (actor, contract) => actor.access.can(PERMISSIONS.CONTRACT_READ, contract.assigningOfficeId ?? contract.officeId);

/**
 * Either side of a contract, whatever its status.
 */
export const canReadEitherSide = async (actor, contract) => (await readsFromAbove(actor, contract)) || actor.access.can(PERMISSIONS.CONTRACT_READ, contract.officeId);

/**
 * A draft or rejected contract is with the office above, so the receiving office sees it only once it is assigned.
 */
export const canSeeContract = async (actor, contract) => {
  if (await readsFromAbove(actor, contract)) return true;
  return !OPEN_CONTRACT_STATUSES.includes(contract.status) && actor.access.can(PERMISSIONS.CONTRACT_READ, contract.officeId);
};

/**
 * Reading: the assigning side sees everything. The receiving office sees an assignment once it is assigned to them.
 */
export const canSeeAssignment = async (actor, contract, status) => {
  if (await readsFromAbove(actor, contract)) return true;
  return ASSIGNED_STATUSES.includes(status) && actor.access.can(PERMISSIONS.CONTRACT_READ, contract.officeId);
};

const OFFICE_REF = { select: { id: true, name: true, code: true } };
const current = { where: { isCurrent: true }, take: 1 };

export const ASSIGNMENT_INCLUDE = {
  contract: { include: { office: OFFICE_REF, assigningOffice: OFFICE_REF, fiscalYear: { select: { id: true, name: true, status: true } } } },
  kpi: {
    include: {
      unit: { select: { id: true, name: true, symbol: true } },
      currency: { select: { id: true, code: true, symbol: true } },
      scale: { include: { levels: { orderBy: { sortOrder: 'asc' } } } },
    },
  },
  reportingFrequency: { select: { id: true, name: true, intervalMonths: true } },
  baselines: { ...current, include: { scaleLevel: { select: { id: true, name: true } }, evidence: true } },
  targets: { ...current, include: { scaleLevel: { select: { id: true, name: true } } } },
  weights: current,
};

const kpiSummary = (kpi) => ({
  id: kpi.id,
  name: kpi.name,
  description: kpi.description,
  measurementType: kpi.measurementType,
  direction: kpi.direction,
  targetType: kpi.targetType,
  isAdditive: kpi.isAdditive,
  evidenceRequirement: kpi.evidenceRequirement,
  unit: kpi.unit,
  currency: kpi.currency,
  scale: kpi.scale ? { id: kpi.scale.id, name: kpi.scale.name, scoringApproved: kpi.scale.scoringApproved } : null,
});

/**
 * Everything an office needs to see about an assignment (SRS 4.2), with the calculated improvement.
 */
export const formatAssignment = (assignment) => {
  const { kpi, contract, baselines, targets, weights, ...rest } = assignment;
  const baseline = baselines[0] ?? null;
  const target = targets[0] ?? null;
  return {
    ...rest,
    kpi: kpiSummary(kpi),
    office: contract.office,
    assigningOffice: contract.assigningOffice,
    fiscalYear: contract.fiscalYear,
    baseline,
    target,
    weight: toNumber(weights[0]?.weight),
    baselineValue: numericValue(kpi, baseline),
    targetValue: numericValue(kpi, target),
    requiredImprovement: requiredImprovement(kpi, baseline, target),
  };
};

export const getAssignmentOrThrow = async (id) => {
  const assignment = await prisma.kpiAssignment.findUnique({ where: { id: parseUuid(id, 'id') }, include: ASSIGNMENT_INCLUDE });
  if (!assignment) throw notFound('Assignment not found');
  return assignment;
};

/**
 * Why a fiscal year cannot take KPIs reported at this frequency, or null when it can. A report only holds the KPIs of
 * its own frequency, so without periods of that frequency the KPI would never be reported.
 */
export const frequencyProblem = async (fiscalYearId, frequencyId) => {
  const [frequency, year, periods] = await Promise.all([
    prisma.reportingFrequency.findUnique({ where: { id: frequencyId }, select: { name: true } }),
    prisma.fiscalYear.findUnique({ where: { id: fiscalYearId }, select: { name: true } }),
    prisma.reportingPeriod.findMany({ where: { fiscalYearId }, distinct: ['frequencyId'], select: { frequencyId: true, frequency: { select: { name: true } } } }),
  ]);
  if (!frequency) return 'Reporting frequency not found';
  if (periods.some((period) => period.frequencyId === frequencyId)) return null;
  const available = periods.map((period) => period.frequency.name).join(', ');
  return `${year.name} has no ${frequency.name} reporting periods, so this KPI would never be reported. Create the ${frequency.name} periods for ${year.name} under Fiscal Years first${available ? `, or choose a frequency it has: ${available}` : ''}`;
};

/**
 * An office reports a KPI as often as the office above it, or more often, so the office above always has its numbers.
 * Custom periods cannot be compared, so they only follow Custom.
 */
export const assertFrequencyFollowsAbove = async (aboveFrequencyId, frequencyId) => {
  if (!aboveFrequencyId || aboveFrequencyId === frequencyId) return;
  const [above, chosen] = await Promise.all([
    prisma.reportingFrequency.findUnique({ where: { id: aboveFrequencyId }, select: { name: true, intervalMonths: true } }),
    prisma.reportingFrequency.findUnique({ where: { id: frequencyId }, select: { name: true, intervalMonths: true } }),
  ]);
  if (!chosen) throw badRequest('Reporting frequency not found');
  if (above?.intervalMonths && chosen.intervalMonths && chosen.intervalMonths < above.intervalMonths) return;
  throw conflict(`The office above reports this KPI ${above?.name ?? 'at another frequency'}, so here it can be reported ${above?.name ?? 'the same'} or more often, not ${chosen.name}`);
};

export const assertYearReportsFrequency = async (fiscalYearId, frequencyId) => {
  const problem = await frequencyProblem(fiscalYearId, frequencyId);
  if (problem) throw conflict(problem);
};

export const requireComment = (value) => {
  const comment = typeof value === 'string' ? value.trim() : '';
  if (!comment) throw badRequest('comment is required');
  return comment;
};

/**
 * Add a new version of a baseline, target or weight, moving is_current to it. The old row stays untouched.
 */
export const addVersion = async (tx, model, assignmentId, data) => {
  const latest = await model.findFirst({ where: { assignmentId }, orderBy: { versionNo: 'desc' }, select: { versionNo: true } });
  await model.updateMany({ where: { assignmentId, isCurrent: true }, data: { isCurrent: false } });
  return model.create({ data: { assignmentId, versionNo: (latest?.versionNo ?? 0) + 1, isCurrent: true, ...data } });
};
