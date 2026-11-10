import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseBoolean, parseEnum, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { assertSeparateApprover, assertWorksOnContract, worksOnContract } from '../05-contract-cascading/contract.shared.js';
import { assertPeriodOpen } from '../06-reporting-periods/period.service.js';
import { assertReviewsContract, reviewsContract } from '../07-performance-scoring/reports/report.access.js';
import { dueAssignments, isDirectEntry } from '../07-performance-scoring/scoring/result.service.js';

/**
 * Module 08 — Evidence behind reported results (SRS 10.3).
 * The reporting office attaches it while the report can still change. The office above verifies it during review.
 * On a staff contract its person attaches it and the head of their office verifies it.
 * The office above can also pass verified evidence of an office below up into its own report, so its reviewer can see
 * what stands behind the figure it reports.
 */

const EDITABLE_REPORT_STATUSES = ['NOT_STARTED', 'DRAFT', 'REVISION_REQUIRED', 'REJECTED'];
const REVIEWABLE_REPORT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
// Evidence of an office below can be passed up from the moment it is verified, until its report is settled for good
const FORWARDABLE_REPORT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

const REPORT_SELECT = {
  id: true,
  status: true,
  reportingPeriodId: true,
  contract: { select: { id: true, officeId: true, assigningOfficeId: true, personId: true, fiscalYearId: true } },
};

const EVIDENCE_INCLUDE = {
  document: {
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      fileId: true,
      documentType: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  verifiedBy: { select: { id: true, firstName: true, lastName: true } },
};

const getValueOrThrow = async (id) => {
  const value = await prisma.performanceValue.findUnique({ where: { id: parseUuid(id, 'id') }, select: { id: true, report: { select: REPORT_SELECT } } });
  if (!value) throw notFound('Performance value not found');
  return value;
};

const getEvidenceOrThrow = async (id) => {
  const evidence = await prisma.performanceEvidence.findUnique({
    where: { id: parseUuid(id, 'id') },
    include: { document: { select: { createdByPersonId: true } }, performanceValue: { select: { report: { select: REPORT_SELECT } } }, _count: { select: { forwardedCopies: true } } },
  });
  if (!evidence) throw notFound('Evidence not found');
  return evidence;
};

// Those who report the results, those who verify them, and on an office contract whoever reads its evidence
const canReadEvidence = async (actor, contract) =>
  (await worksOnContract(actor, PERMISSIONS.EVIDENCE_READ, contract)) || (await reviewsContract(actor, PERMISSIONS.EVIDENCE_VERIFY, contract)) || (!contract.personId && (await actor.access.can(PERMISSIONS.EVIDENCE_VERIFY, contract.officeId)));

export const listEvidence = async (performanceValueId, actor) => {
  const value = await getValueOrThrow(performanceValueId);
  if (!(await canReadEvidence(actor, value.report.contract))) throw forbidden('You cannot read the evidence of these results');
  return prisma.performanceEvidence.findMany({ where: { performanceValueId: value.id }, include: EVIDENCE_INCLUDE, orderBy: { createdAt: 'asc' } });
};

export const attachEvidence = async (performanceValueId, { documentId, comment } = {}, actor) => {
  const { id, report } = await getValueOrThrow(performanceValueId);
  await assertWorksOnContract(actor, PERMISSIONS.EVIDENCE_LINK, report.contract);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence cannot be added to a ${report.status} report`);

  const document = await prisma.document.findUnique({ where: { id: parseUuid(documentId, 'documentId') }, select: { id: true, ownerOfficeId: true } });
  if (!document) throw badRequest('Document not found');
  if (document.ownerOfficeId !== report.contract.officeId) throw badRequest("The document must belong to the reporting office");

  const evidence = await prisma.performanceEvidence.create({
    data: { performanceValueId: id, documentId: document.id, comment: optionalString(comment, 'comment') ?? null },
    include: EVIDENCE_INCLUDE,
  });
  await auditAction(actor, { action: 'EVIDENCE_ATTACHED', entityType: 'performance_evidence', entityId: evidence.id, newValues: { performanceValueId: id, documentId: document.id } });
  return evidence;
};

/**
 * A result the office did not type, because it adds up the offices below, has no stored figure to hang evidence on.
 * The row that stands for it is created empty and marked not reported, as it would be at submission.
 */
const ensureValueRow = (reportId, assignmentId, personId) =>
  prisma.performanceValue.upsert({
    where: { reportId_assignmentId_contributionType: { reportId, assignmentId, contributionType: 'DIRECT' } },
    update: {},
    create: { reportId, assignmentId, contributionType: 'DIRECT', reportingStatus: 'NOT_REPORTED', enteredByPersonId: personId },
  });

/**
 * Attach a document to a KPI of a report, with or without a typed figure: an office that only adds up the offices
 * below attaches its own evidence this way.
 */
export const attachEvidenceToLine = async (reportId, body = {}, actor) => {
  const report = await prisma.performanceReport.findUnique({ where: { id: parseUuid(reportId, 'id') }, include: { reportingPeriod: true, contract: { select: { id: true, officeId: true, personId: true } } } });
  if (!report) throw notFound('Report not found');
  await assertWorksOnContract(actor, PERMISSIONS.EVIDENCE_LINK, report.contract);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence cannot be added to a ${report.status} report`);

  const assignmentId = parseUuid(body.assignmentId, 'assignmentId');
  const assignment = (await dueAssignments(report.contractId, report.reportingPeriod)).find((item) => item.id === assignmentId);
  if (!assignment || !isDirectEntry(assignment, report.reportingPeriod)) throw badRequest('This KPI is not reported in this report');
  if (assignment.staffParts.length > 0) throw badRequest('This KPI is held by people of the office. Their own results carry the evidence');

  const row = await ensureValueRow(report.id, assignment.id, actor.personId);
  return attachEvidence(row.id, body, actor);
};

export const removeEvidence = async (id, actor) => {
  const evidence = await getEvidenceOrThrow(id);
  const { report } = evidence.performanceValue;
  await assertWorksOnContract(actor, PERMISSIONS.EVIDENCE_LINK, report.contract);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence cannot be removed from a ${report.status} report`);
  if (evidence._count.forwardedCopies > 0) throw conflict('This evidence is used in the report of the office above. It has to take it out of its report first');

  await prisma.performanceEvidence.delete({ where: { id: evidence.id } });
  await auditAction(actor, { action: 'EVIDENCE_REMOVED', entityType: 'performance_evidence', entityId: evidence.id, oldValues: { performanceValueId: evidence.performanceValueId, documentId: evidence.documentId } });
};

/**
 * The reviewer verifies or rejects evidence. A rejection needs a comment, so the office knows what to fix.
 */
export const verifyEvidence = async (id, { status, comment, forward } = {}, actor) => {
  const evidence = await getEvidenceOrThrow(id);
  const { report } = evidence.performanceValue;
  await assertFiscalYearOpen(report.contract.fiscalYearId);
  await assertReviewsContract(actor, PERMISSIONS.EVIDENCE_VERIFY, report.contract);
  await assertSeparateApprover(actor, evidence.document.createdByPersonId);
  if (!REVIEWABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence is verified while a report is under review; this one is ${report.status}`);

  const outcome = parseEnum(status, 'status', ['VERIFIED', 'REJECTED']);
  const cleanComment = optionalString(comment, 'comment') ?? null;
  if (outcome === 'REJECTED' && !cleanComment) throw badRequest('comment is required when rejecting evidence');
  if (outcome === 'REJECTED' && evidence._count.forwardedCopies > 0) throw conflict('This evidence was passed up into the report of the office above. It has to be taken out of that report first');
  const passUp = parseBoolean(forward, 'forward') === true;
  if (passUp && outcome !== 'VERIFIED') throw badRequest('Only verified evidence can be passed up');

  const updated = await prisma.performanceEvidence.update({
    where: { id: evidence.id },
    data: { verificationStatus: outcome, verifiedByPersonId: actor.personId, verifiedAt: new Date(), comment: cleanComment },
    include: EVIDENCE_INCLUDE,
  });
  await auditAction(actor, {
    action: outcome === 'VERIFIED' ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_REJECTED',
    entityType: 'performance_evidence',
    entityId: evidence.id,
    oldValues: { verificationStatus: evidence.verificationStatus },
    newValues: { verificationStatus: outcome },
    reason: cleanComment ?? undefined,
  });

  if (passUp) {
    try {
      await setForward(evidence.id, { forward: true }, actor);
    } catch (error) {
      error.message = `Verified, but not passed up: ${error.message}`;
      throw error;
    }
  }
  return updated;
};

/**
 * Pass verified evidence of this office's report up into the report of the office above, or take it back out. The
 * office above gets the same document in its own report, still owned by the office it came from, and its reviewer
 * verifies it there in turn.
 */
export const setForward = async (id, { forward } = {}, actor) => {
  const pass = parseBoolean(forward, 'forward');
  if (pass === undefined) throw badRequest('forward must be true or false');

  const source = await prisma.performanceEvidence.findUnique({
    where: { id: parseUuid(id, 'id') },
    include: {
      forwardedCopies: { select: { id: true, performanceValue: { select: { report: { select: REPORT_SELECT } } }, _count: { select: { forwardedCopies: true } } } },
      performanceValue: { select: { assignment: { select: { parentAssignmentId: true } }, report: { select: { ...REPORT_SELECT, reportingPeriod: { select: { startDate: true, endDate: true } } } } } },
    },
  });
  if (!source) throw notFound('Evidence not found');
  const { report, assignment } = source.performanceValue;
  await assertFiscalYearOpen(report.contract.fiscalYearId);
  await assertReviewsContract(actor, PERMISSIONS.EVIDENCE_VERIFY, report.contract);
  if (report.contract.personId) throw badRequest("Evidence of a staff contract is not passed up. The office's figure is made up from its people's approved results");
  if (!FORWARDABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence is passed up once the report is submitted; this one is ${report.status}`);
  if (!assignment.parentAssignmentId) throw badRequest('No office above this one holds this KPI, so there is nowhere to pass this evidence');

  const copy = source.forwardedCopies[0] ?? null;
  if (!pass) {
    if (!copy) return { id: source.id, isForwarded: false };
    const placed = copy.performanceValue.report;
    if (!EDITABLE_REPORT_STATUSES.includes(placed.status)) throw conflict(`The report of the office above is already ${placed.status}. It cannot take this evidence out any more`);
    if (copy._count.forwardedCopies > 0) throw conflict('The office above passed this evidence on again. It has to take it out first');
    await prisma.performanceEvidence.delete({ where: { id: copy.id } });
    await auditAction(actor, { action: 'EVIDENCE_UNFORWARDED', entityType: 'performance_evidence', entityId: source.id, oldValues: { forwardedAs: copy.id } });
    return { id: source.id, isForwarded: false };
  }

  if (source.verificationStatus !== 'VERIFIED') throw conflict('Only verified evidence can be passed up');
  if (copy) return { id: source.id, isForwarded: true };

  const target = await prisma.kpiAssignment.findUnique({ where: { id: assignment.parentAssignmentId }, select: { id: true, reportingFrequencyId: true, contract: { select: { id: true, status: true, office: { select: { name: true } } } } } });
  // The office above may report in longer periods: take the one that holds this period
  const period = await prisma.reportingPeriod.findFirst({
    where: { fiscalYearId: report.contract.fiscalYearId, frequencyId: target.reportingFrequencyId, startDate: { lte: report.reportingPeriod.startDate }, endDate: { gte: report.reportingPeriod.endDate } },
  });
  if (!period) throw badRequest(`${target.contract.office.name} reports this KPI in periods that do not cover this one`);
  await assertPeriodOpen(period.id);
  if (!['APPROVED', 'SIGNED'].includes(target.contract.status)) throw conflict(`The contract of ${target.contract.office.name} is not approved yet`);

  const targetReport =
    (await prisma.performanceReport.findUnique({ where: { contractId_reportingPeriodId: { contractId: target.contract.id, reportingPeriodId: period.id } } })) ??
    (await prisma.performanceReport.create({ data: { contractId: target.contract.id, reportingPeriodId: period.id, status: 'DRAFT', preparedByPersonId: actor.personId } }));
  if (!EDITABLE_REPORT_STATUSES.includes(targetReport.status)) throw conflict(`The report of ${target.contract.office.name} for this period is already ${targetReport.status}`);

  const row = await ensureValueRow(targetReport.id, target.id, actor.personId);
  const created = await prisma.performanceEvidence.upsert({
    where: { performanceValueId_documentId: { performanceValueId: row.id, documentId: source.documentId } },
    update: {},
    create: { performanceValueId: row.id, documentId: source.documentId, forwardedFromId: source.id },
  });
  await auditAction(actor, { action: 'EVIDENCE_FORWARDED', entityType: 'performance_evidence', entityId: source.id, newValues: { forwardedAs: created.id, reportId: targetReport.id } });
  return { id: source.id, isForwarded: true };
};

export default { listEvidence, attachEvidence, attachEvidenceToLine, removeEvidence, verifyEvidence, setForward };
