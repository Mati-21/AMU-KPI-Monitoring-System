import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { optionalString, parseEnum, parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { assertAuthorityFromAbove, assertSeparateApprover } from '../05-contract-cascading/contract.shared.js';
import { assertPeriodOpen } from '../06-reporting-periods/period.service.js';

/**
 * Module 08 — Evidence behind reported results (SRS 10.3).
 * The reporting office attaches it while the report can still change. The office above verifies it during review.
 */

const EDITABLE_REPORT_STATUSES = ['NOT_STARTED', 'DRAFT', 'REVISION_REQUIRED', 'REJECTED'];
const REVIEWABLE_REPORT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

const REPORT_SELECT = {
  id: true,
  status: true,
  reportingPeriodId: true,
  contract: { select: { id: true, officeId: true, assigningOfficeId: true, fiscalYearId: true } },
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
    include: { document: { select: { createdByPersonId: true } }, performanceValue: { select: { report: { select: REPORT_SELECT } } } },
  });
  if (!evidence) throw notFound('Evidence not found');
  return evidence;
};

const assertOfficeScope = async (actor, code, officeId) => {
  if (!(await actor.access.can(code, officeId))) throw forbidden(`You need ${code} authority over this office`);
};

export const listEvidence = async (performanceValueId, actor) => {
  const value = await getValueOrThrow(performanceValueId);
  await assertOfficeScope(actor, PERMISSIONS.EVIDENCE_READ, value.report.contract.officeId);
  return prisma.performanceEvidence.findMany({ where: { performanceValueId: value.id }, include: EVIDENCE_INCLUDE, orderBy: { createdAt: 'asc' } });
};

export const attachEvidence = async (performanceValueId, { documentId, comment } = {}, actor) => {
  const { id, report } = await getValueOrThrow(performanceValueId);
  await assertOfficeScope(actor, PERMISSIONS.EVIDENCE_LINK, report.contract.officeId);
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

export const removeEvidence = async (id, actor) => {
  const evidence = await getEvidenceOrThrow(id);
  const { report } = evidence.performanceValue;
  await assertOfficeScope(actor, PERMISSIONS.EVIDENCE_LINK, report.contract.officeId);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence cannot be removed from a ${report.status} report`);

  await prisma.performanceEvidence.delete({ where: { id: evidence.id } });
  await auditAction(actor, { action: 'EVIDENCE_REMOVED', entityType: 'performance_evidence', entityId: evidence.id, oldValues: { performanceValueId: evidence.performanceValueId, documentId: evidence.documentId } });
};

/**
 * The reviewer verifies or rejects evidence. A rejection needs a comment, so the office knows what to fix.
 */
export const verifyEvidence = async (id, { status, comment } = {}, actor) => {
  const evidence = await getEvidenceOrThrow(id);
  const { report } = evidence.performanceValue;
  await assertFiscalYearOpen(report.contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.EVIDENCE_VERIFY, report.contract);
  await assertSeparateApprover(actor, evidence.document.createdByPersonId);
  if (!REVIEWABLE_REPORT_STATUSES.includes(report.status)) throw conflict(`Evidence is verified while a report is under review; this one is ${report.status}`);

  const outcome = parseEnum(status, 'status', ['VERIFIED', 'REJECTED']);
  const cleanComment = optionalString(comment, 'comment') ?? null;
  if (outcome === 'REJECTED' && !cleanComment) throw badRequest('comment is required when rejecting evidence');

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
  return updated;
};

export default { listEvidence, attachEvidence, removeEvidence, verifyEvidence };
