import { prisma } from '../../../config/database.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { startOfTodayUtc } from '../../../utils/dates.js';
import { badRequest, conflict, notFound } from '../../../utils/httpError.js';
import { parseEnum, parseUuid } from '../../../utils/validation.js';
import { assertFiscalYearOpen } from '../../04-kpi-catalog/fiscalYear.service.js';
import { APPROVED_STATUSES, PERSON_REF, assertSeparateApprover, assertWorksOnContract, requireComment, worksOnContract } from '../../05-contract-cascading/contract.shared.js';
import { assertPeriodOpen } from '../../06-reporting-periods/period.service.js';
import { addDays } from '../../06-reporting-periods/period.rules.js';
import { lowPerformance, reportReopened, reportReviewed, reportSubmitted } from '../../09-notifications/notification.events.js';
import { getSetting } from '../../10-system-governance/system.service.js';
import { findLowResults, previewLines, recalculateReport } from '../scoring/scoring.service.js';
import { dueAssignments, isDirectEntry } from '../scoring/result.service.js';
import { assertCanSeeReport, assertReviewsContract, canSeeReport, ownOfficeIdsOf, reviewsContract, sideOf } from './report.access.js';
import { EDITABLE_STATUSES } from './reportValue.service.js';

/**
 * Module 07 — The reporting workflow (SRS 10.4):
 * DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED, or REVISION_REQUIRED / REJECTED, which the office fixes and resubmits.
 * Approved results feed the office above and the year end.
 * A staff contract is reported the same way by its person, and reviewed by the head of their office.
 */

const REPORT_STATUSES = ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'OVERDUE'];
const SIGNED_OR_APPROVED = ['APPROVED', 'SIGNED'];

const REPORT_INCLUDE = {
  contract: {
    select: {
      id: true,
      status: true,
      officeId: true,
      assigningOfficeId: true,
      personId: true,
      fiscalYearId: true,
      person: PERSON_REF,
      office: { select: { id: true, name: true, code: true } },
      assigningOffice: { select: { id: true, name: true, code: true } },
    },
  },
  reportingPeriod: { include: { fiscalYear: { select: { id: true, name: true, status: true, startDate: true, endDate: true } }, frequency: { select: { id: true, name: true } } } },
  reviews: { orderBy: { reviewedAt: 'desc' }, include: { reviewer: { select: { id: true, firstName: true, lastName: true } } } },
  lateAllowedBy: { select: { id: true, firstName: true, lastName: true } },
};

const getReportOrThrow = async (id) => {
  const report = await prisma.performanceReport.findUnique({ where: { id: parseUuid(id, 'id') }, include: REPORT_INCLUDE });
  if (!report) throw notFound('Report not found');
  return report;
};

const isOverdue = (report, today = startOfTodayUtc()) => {
  const { submissionDeadline } = report.reportingPeriod;
  return EDITABLE_STATUSES.includes(report.status) && Boolean(submissionDeadline) && today > submissionDeadline;
};

const EVIDENCE_SELECT = {
  id: true,
  performanceValueId: true,
  verificationStatus: true,
  comment: true,
  verifiedAt: true,
  document: { select: { id: true, title: true, fileId: true, createdAt: true } },
  verifiedBy: { select: { id: true, firstName: true, lastName: true } },
};

// The office's figure made up from its people, in the shape of a stored result
const staffFigure = (result) => ({ value: null, numerator: null, denominator: null, scaleLevelId: null, ...result, reportingStatus: result ? 'REPORTED' : 'NOT_REPORTED', note: 'Added up from staff results' });

const formatLine = (line) => ({
  assignmentId: line.assignment.id,
  kpi: {
    id: line.assignment.kpi.id,
    name: line.assignment.kpi.name,
    measurementType: line.assignment.kpi.measurementType,
    direction: line.assignment.kpi.direction,
    unit: line.assignment.kpi.unit,
    currency: line.assignment.kpi.currency,
    evidenceRequirement: line.assignment.kpi.evidenceRequirement,
    levels: line.assignment.kpi.scale?.levels.map(({ id, name }) => ({ id, name })) ?? [],
  },
  isDirectEntry: line.isDirectEntry,
  weight: line.weight,
  baseline: line.baseline,
  target: line.target,
  // Held by people of the office: their approved results, added up, are the office's own figure
  fromStaff: line.resolved.fromStaff,
  staff: line.resolved.staff.map(({ assignmentId, person, result, isComplete }) => ({ assignmentId, person, result, isComplete })),
  direct: line.resolved.fromStaff ? { ...line.directRow, ...staffFigure(line.resolved.direct) } : line.directRow,
  aggregated: line.resolved.aggregated,
  offices: line.resolved.children.map(({ assignmentId, office, result, isComplete, targetMet, targetAchievement }) => ({ assignmentId, office, result, isComplete, targetMet, targetAchievement })),
  total: line.resolved.total,
  actualSoFar: line.actual,
  achievement: line.achievement,
  threshold: line.threshold ? { id: line.threshold.id, name: line.threshold.name, color: line.threshold.color } : null,
  isComplete: line.resolved.isComplete,
  isProvisional: line.isProvisional,
});

// ===== Queries =====

export const listReports = async ({ contractId, officeId, reportingPeriodId, fiscalYearId, status } = {}, actor) => {
  const reports = await prisma.performanceReport.findMany({
    where: {
      ...(contractId && { contractId: parseUuid(contractId, 'contractId') }),
      ...(reportingPeriodId && { reportingPeriodId: parseUuid(reportingPeriodId, 'reportingPeriodId') }),
      ...(status && { status: parseEnum(status, 'status', REPORT_STATUSES) }),
      ...((officeId || fiscalYearId) && {
        contract: {
          ...(officeId && { officeId: parseUuid(officeId, 'officeId') }),
          ...(fiscalYearId && { fiscalYearId: parseUuid(fiscalYearId, 'fiscalYearId') }),
        },
      }),
    },
    include: REPORT_INCLUDE,
    orderBy: [{ reportingPeriod: { endDate: 'desc' } }, { contract: { office: { name: 'asc' } } }],
  });

  const today = startOfTodayUtc();
  const own = await ownOfficeIdsOf(actor);
  const visible = [];
  for (const report of reports) {
    // OWN: the person's office, or the person, reports it; BELOW: it is sent up to them
    if (await canSeeReport(actor, report)) visible.push({ ...report, isOverdue: isOverdue(report, today), side: sideOf(actor, report.contract, own) });
  }
  return visible;
};

/**
 * What the person may do with a report right now, so the screen offers only that.
 */
const allowedActions = async (report, actor) => {
  const { contract } = report;
  const yearOpen = report.reportingPeriod.fiscalYear.status !== 'CLOSED';
  const editable = yearOpen && !report.reportingPeriod.isClosed && EDITABLE_STATUSES.includes(report.status);
  const underReview = yearOpen && ['SUBMITTED', 'UNDER_REVIEW'].includes(report.status);
  const deadline = await deadlineState(report.reportingPeriod, report);
  return {
    deadline,
    edit: editable && (await worksOnContract(actor, PERMISSIONS.REPORT_CREATE, contract)),
    submit: editable && !deadline.isLocked && (await worksOnContract(actor, PERMISSIONS.REPORT_SUBMIT, contract)),
    allowLate: editable && deadline.isLate && actor.access.isSuperAdmin,
    attachEvidence: editable && (await worksOnContract(actor, PERMISSIONS.EVIDENCE_LINK, contract)),
    review: underReview && (await reviewsContract(actor, PERMISSIONS.REPORT_REVIEW, contract)),
    verifyEvidence: underReview && (await reviewsContract(actor, PERMISSIONS.EVIDENCE_VERIFY, contract)),
    reopen: yearOpen && !report.reportingPeriod.isClosed && report.status === 'APPROVED' && actor.access.isSuperAdmin,
  };
};

/**
 * A report with every KPI line: the baseline, target, figures and achievement, calculated fresh.
 */
export const getReportById = async (id, actor) => {
  const report = await getReportOrThrow(id);
  await assertCanSeeReport(actor, report);
  const lines = await previewLines(report);
  const valueIds = lines.map((line) => line.directRow?.id).filter(Boolean);
  const evidence = await prisma.performanceEvidence.findMany({ where: { performanceValueId: { in: valueIds } }, select: EVIDENCE_SELECT, orderBy: { createdAt: 'asc' } });
  return {
    ...report,
    isOverdue: isOverdue(report),
    side: sideOf(actor, report.contract, await ownOfficeIdsOf(actor)),
    can: await allowedActions(report, actor),
    lines: lines.map((line) => ({ ...formatLine(line), evidence: evidence.filter((item) => item.performanceValueId === line.directRow?.id) })),
  };
};

// ===== Workflow =====

/**
 * Start an office's report for a period. The contract must be approved first.
 */
export const createReport = async ({ contractId, reportingPeriodId } = {}, actor) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(contractId, 'contractId') } });
  if (!contract) throw badRequest('Contract not found');
  await assertWorksOnContract(actor, PERMISSIONS.REPORT_CREATE, contract);
  if (!SIGNED_OR_APPROVED.includes(contract.status)) throw conflict(`Reports start once the contract is approved; this one is ${contract.status}`);

  const period = await assertPeriodOpen(parseUuid(reportingPeriodId, 'reportingPeriodId'));
  if (period.fiscalYearId !== contract.fiscalYearId) throw badRequest('The period belongs to a different fiscal year');

  const due = await dueAssignments(contract.id, period);
  if (due.length === 0) throw badRequest('This contract has no KPIs to report in this period');

  const existing = await prisma.performanceReport.findUnique({ where: { contractId_reportingPeriodId: { contractId: contract.id, reportingPeriodId: period.id } } });
  if (existing) throw conflict('This office already has a report for this period');

  const report = await prisma.performanceReport.create({ data: { contractId: contract.id, reportingPeriodId: period.id, status: 'DRAFT', preparedByPersonId: actor.personId }, include: REPORT_INCLUDE });
  await auditAction(actor, { action: 'REPORT_STARTED', entityType: 'performance_report', entityId: report.id, newValues: { contractId: contract.id, reportingPeriodId: period.id } });
  return report;
};

/**
 * Where a report stands against its period's deadline today. A submission now is late once the deadline has passed.
 * It is locked once late submissions are not allowed, or the grace period is over, unless the Super Admin allowed
 * this office to submit until a later day.
 */
export const deadlineState = async (period, report, today = startOfTodayUtc()) => {
  if (!period.submissionDeadline || today <= period.submissionDeadline) return { isLate: false, isLocked: false, lockedSince: null };

  const [allowLate, graceDays, autoLock] = await Promise.all([
    getSetting('reporting', 'allow_late_submission'),
    getSetting('reporting', 'late_submission_grace_days'),
    getSetting('reporting', 'auto_lock_after_deadline'),
  ]);
  const graceEnds = addDays(period.submissionDeadline, graceDays);
  const pastAllowed = !allowLate || (autoLock && today > graceEnds);
  const unlocked = Boolean(report?.lateAllowedUntil) && today <= report.lateAllowedUntil;
  return { isLate: true, isLocked: pastAllowed && !unlocked, lockedSince: pastAllowed ? (allowLate ? graceEnds : period.submissionDeadline) : null };
};

/**
 * Whether the deadline still allows this report to be submitted. Returns true when it is late but accepted.
 */
const checkDeadline = async (period, report) => {
  const { isLate, isLocked } = await deadlineState(period, report);
  if (isLocked) throw conflict('The submission deadline and grace period have passed. Only the Super Admin can allow a late submission');
  return isLate;
};

/**
 * Where the university requires it, every reported result needs evidence.
 */
const assertEvidenceAttached = async (report) => {
  if (!(await getSetting('reporting', 'require_evidence'))) return;
  const missing = await prisma.performanceValue.findMany({
    where: { reportId: report.id, contributionType: 'DIRECT', reportingStatus: 'REPORTED', evidence: { none: {} }, assignment: { staffParts: { none: { status: { in: APPROVED_STATUSES } } } } },
    select: { assignment: { select: { kpi: { select: { name: true } } } } },
  });
  if (missing.length > 0) throw conflict(`Attach evidence for: ${missing.map((row) => row.assignment.kpi.name).join(', ')}`);
};

/**
 * Results the office left blank are stated as such, or filled with 0 and marked if the university's policy says so.
 * Only plain numbers can be auto-filled: a percentage or a stage has no honest zero.
 */
const recordMissingResults = async (report, actor) => {
  const policy = await getSetting('kpi', 'missing_result_policy');
  const due = (await dueAssignments(report.contractId, report.reportingPeriod)).filter((assignment) => isDirectEntry(assignment, report.reportingPeriod) && assignment.staffParts.length === 0);
  const entered = new Set((await prisma.performanceValue.findMany({ where: { reportId: report.id, contributionType: 'DIRECT' }, select: { assignmentId: true } })).map((row) => row.assignmentId));

  for (const assignment of due.filter((item) => !entered.has(item.id))) {
    const { measurementType, currencyId } = assignment.kpi;
    const canFill = policy === 'AUTO_FILL_ZERO' && ['NUMBER', 'MONEY'].includes(measurementType);
    await prisma.performanceValue.create({
      data: {
        reportId: report.id,
        assignmentId: assignment.id,
        contributionType: 'DIRECT',
        reportingStatus: canFill ? 'AUTO_FILLED' : 'NOT_REPORTED',
        value: canFill ? 0 : null,
        convertedValue: canFill && measurementType === 'MONEY' ? 0 : null,
        currencyId: canFill && measurementType === 'MONEY' ? currencyId : null,
        enteredByPersonId: actor.personId,
      },
    });
  }
};

export const submitReport = async (id, actor) => {
  const report = await getReportOrThrow(id);
  await assertWorksOnContract(actor, PERMISSIONS.REPORT_SUBMIT, report.contract);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_STATUSES.includes(report.status)) throw conflict(`A ${report.status} report cannot be submitted`);

  const isLate = await checkDeadline(report.reportingPeriod, report);
  await assertEvidenceAttached(report);
  await recordMissingResults(report, actor);

  // Once late, always late: a resubmission after a revision does not clear it
  await prisma.performanceReport.update({ where: { id: report.id }, data: { status: 'SUBMITTED', submittedByPersonId: actor.personId, submittedAt: new Date(), isLate: report.isLate || isLate } });
  await auditAction(actor, { action: 'REPORT_SUBMITTED', entityType: 'performance_report', entityId: report.id, oldValues: { status: report.status }, newValues: { status: 'SUBMITTED', isLate } });
  await recalculateReport(report.id, actor);
  await reportSubmitted(report, actor);
  return { ...(await getReportOrThrow(id)), isLate };
};

export const startReview = async (id, actor) => {
  const report = await getReportOrThrow(id);
  await assertFiscalYearOpen(report.contract.fiscalYearId);
  await assertReviewsContract(actor, PERMISSIONS.REPORT_REVIEW, report.contract);
  if (report.status !== 'SUBMITTED') throw conflict(`Only a submitted report can go under review; this one is ${report.status}`);

  const updated = await prisma.performanceReport.update({ where: { id: report.id }, data: { status: 'UNDER_REVIEW' }, include: REPORT_INCLUDE });
  await auditAction(actor, { action: 'REPORT_REVIEW_STARTED', entityType: 'performance_report', entityId: report.id, oldValues: { status: report.status }, newValues: { status: 'UNDER_REVIEW' } });
  return updated;
};

/**
 * Every reported result must have passed verification before approval (SRS 17.25).
 */
const assertEvidenceSettled = async (reportId) => {
  const open = await prisma.performanceEvidence.count({
    where: { performanceValue: { reportId }, verificationStatus: { not: 'VERIFIED' } },
  });
  if (open > 0) throw conflict(`${open} evidence item(s) are not verified yet`);
};

/**
 * Decide a report. Approval makes its results official and refreshes everything that depends on them.
 * Rejecting or asking for revision needs a comment, which is the office's feedback.
 */
export const reviewReport = async (id, { decision, comment } = {}, actor) => {
  const report = await getReportOrThrow(id);
  await assertFiscalYearOpen(report.contract.fiscalYearId);
  await assertReviewsContract(actor, PERMISSIONS.REPORT_REVIEW, report.contract);
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(report.status)) throw conflict(`Only a submitted report can be reviewed; this one is ${report.status}`);
  await assertSeparateApprover(actor, report.preparedByPersonId);

  const outcome = parseEnum(decision, 'decision', ['APPROVED', 'REJECTED', 'REVISION_REQUIRED']);
  const cleanComment = outcome === 'APPROVED' ? (typeof comment === 'string' && comment.trim()) || null : requireComment(comment);
  if (outcome === 'APPROVED') await assertEvidenceSettled(report.id);

  await prisma.$transaction([
    prisma.performanceReview.create({ data: { reportId: report.id, reviewerPersonId: actor.personId, reviewerOfficeId: report.contract.assigningOfficeId, decision: outcome, comment: cleanComment } }),
    prisma.performanceReport.update({ where: { id: report.id }, data: { status: outcome } }),
  ]);
  await auditAction(actor, {
    action: `REPORT_${outcome}`,
    entityType: 'performance_report',
    entityId: report.id,
    oldValues: { status: report.status },
    newValues: { status: outcome },
    reason: cleanComment ?? undefined,
  });

  await reportReviewed(report, outcome, cleanComment, actor);
  if (outcome === 'APPROVED') {
    await recalculateReport(report.id, actor);
    await lowPerformance(report, await findLowResults(report.id), actor);
  }
  return getReportOrThrow(id);
};

/**
 * Super Admin only: let one office submit a period after its deadline and grace period, until a given number of days
 * from today. The report is started if the office never started it. Whatever was agreed outside the system, such as a
 * penalty, belongs in the reason; the submission is marked late either way.
 */
export const allowLateSubmission = async ({ contractId, reportingPeriodId, days, reason } = {}, actor) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(contractId, 'contractId') } });
  if (!contract) throw badRequest('Contract not found');
  if (!SIGNED_OR_APPROVED.includes(contract.status)) throw conflict(`Reports start once the contract is approved; this one is ${contract.status}`);
  const period = await assertPeriodOpen(parseUuid(reportingPeriodId, 'reportingPeriodId'));
  if (period.fiscalYearId !== contract.fiscalYearId) throw badRequest('The period belongs to a different fiscal year');
  const cleanReason = requireComment(reason);
  const dayCount = days === undefined || days === null || days === '' ? 7 : Number(days);
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 60) throw badRequest('days must be a whole number from 1 to 60');

  const existing = await prisma.performanceReport.findUnique({ where: { contractId_reportingPeriodId: { contractId: contract.id, reportingPeriodId: period.id } } });
  if (existing && !EDITABLE_STATUSES.includes(existing.status)) throw conflict(`This report is already ${existing.status}`);
  const until = addDays(startOfTodayUtc(), dayCount);
  const data = { lateAllowedUntil: until, lateAllowedReason: cleanReason, lateAllowedByPersonId: actor.personId };
  const report = existing
    ? await prisma.performanceReport.update({ where: { id: existing.id }, data, include: REPORT_INCLUDE })
    : await prisma.performanceReport.create({ data: { contractId: contract.id, reportingPeriodId: period.id, status: 'DRAFT', ...data }, include: REPORT_INCLUDE });

  await auditAction(actor, { action: 'REPORT_LATE_ALLOWED', entityType: 'performance_report', entityId: report.id, newValues: { lateAllowedUntil: until, days: dayCount }, reason: cleanReason });
  return report;
};

/**
 * Super Admin only: reopen an approved report to correct a mistake found later. The reason is required and kept.
 * Its results stop counting as official, and everything that depended on them is recalculated straight away.
 */
export const reopenReport = async (id, { reason } = {}, actor) => {
  const report = await getReportOrThrow(id);
  await assertPeriodOpen(report.reportingPeriodId);
  if (report.status !== 'APPROVED') throw conflict(`Only an approved report can be reopened; this one is ${report.status}`);
  const cleanReason = requireComment(reason);

  await prisma.performanceReport.update({ where: { id: report.id }, data: { status: 'REVISION_REQUIRED' } });
  await auditAction(actor, {
    action: 'REPORT_REOPENED',
    entityType: 'performance_report',
    entityId: report.id,
    oldValues: { status: report.status },
    newValues: { status: 'REVISION_REQUIRED' },
    reason: cleanReason,
  });
  await recalculateReport(report.id, actor);
  await reportReopened(report, cleanReason, actor);
  return getReportOrThrow(id);
};

export default { listReports, getReportById, allowLateSubmission, createReport, submitReport, startReview, reviewReport, reopenReport };
