import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
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

const hasAuthorityFromAbove = (actor, code, contract) =>
  contract.assigningOfficeId ? actor.access.can(code, contract.assigningOfficeId) : actor.access.canGlobally(code);

export const assertAuthorityFromAbove = async (actor, code, contract) => {
  if (!(await hasAuthorityFromAbove(actor, code, contract))) {
    throw forbidden(`You need ${code} authority over the assigning office of this contract`);
  }
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

/**
 * Reading: the assigning side sees everything. The receiving office sees an assignment only once it is approved.
 */
export const canSeeAssignment = async (actor, contract, status) => {
  if (await hasAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_READ, contract)) return true;
  return APPROVED_STATUSES.includes(status) && actor.access.can(PERMISSIONS.CONTRACT_READ, contract.officeId);
};

const OFFICE_REF = { select: { id: true, name: true, code: true } };
const current = { where: { isCurrent: true }, take: 1 };

export const ASSIGNMENT_INCLUDE = {
  contract: { include: { office: OFFICE_REF, assigningOffice: OFFICE_REF, fiscalYear: { select: { id: true, name: true, status: true } } } },
  kpi: {
    include: {
      strategicObjective: { select: { id: true, code: true, name: true } },
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
  code: kpi.code,
  name: kpi.name,
  description: kpi.description,
  measurementType: kpi.measurementType,
  direction: kpi.direction,
  targetType: kpi.targetType,
  isAdditive: kpi.isAdditive,
  evidenceRequirement: kpi.evidenceRequirement,
  strategicObjective: kpi.strategicObjective,
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
