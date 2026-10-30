import { prisma } from '../../../config/database.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { PERMISSIONS } from '../../../config/permissions.js';
import { badRequest, conflict, notFound } from '../../../utils/httpError.js';
import { optionalString, parseEnum, parseNumber, parseUuid } from '../../../utils/validation.js';
import { parseMeasuredValue } from '../../05-contract-cascading/measurement.js';
import { assertPeriodOpen } from '../../06-reporting-periods/period.service.js';
import { dueAssignments, isDirectEntry } from '../scoring/result.service.js';
import { assertOfficeAuthority } from './report.access.js';

/**
 * Module 07 — Entering an office's own results (SRS 10.2). Fields follow the KPI's measurement type.
 * Only the DIRECT figure is ever typed in; aggregated and total figures are calculated.
 */

export const EDITABLE_STATUSES = ['NOT_STARTED', 'DRAFT', 'REVISION_REQUIRED', 'REJECTED'];

const EMPTY_VALUE = { value: null, numerator: null, denominator: null, scaleLevelId: null, currencyId: null, convertedValue: null, exchangeRateId: null };

/**
 * A money result can be entered in another currency. The original amount and currency are kept, and it is converted
 * into the KPI's currency with the latest rate on or before the period's end (SRS 7.6).
 */
const parseMoney = async (kpi, input, period, field) => {
  const value = parseNumber(input.value, `${field}.value`, { required: true });
  if (value < 0) throw badRequest(`${field}.value cannot be negative`);
  const currencyId = parseUuid(input.currencyId, `${field}.currencyId`, { required: false }) ?? kpi.currencyId;
  if (currencyId === kpi.currencyId) return { ...EMPTY_VALUE, value, currencyId, convertedValue: value };

  const rate = await prisma.exchangeRate.findFirst({
    where: { fromCurrencyId: currencyId, toCurrencyId: kpi.currencyId, rateDate: { lte: period.endDate } },
    orderBy: { rateDate: 'desc' },
  });
  if (!rate) throw badRequest(`${field}: no exchange rate into the KPI's currency exists for this period`);
  return { ...EMPTY_VALUE, value, currencyId, convertedValue: Math.round(value * Number(rate.rate) * 10000) / 10000, exchangeRateId: rate.id };
};

const parseEntry = async (assignment, entry, period, field) => {
  const reportingStatus = parseEnum(entry.reportingStatus ?? 'REPORTED', `${field}.reportingStatus`, ['REPORTED', 'NOT_REPORTED']);
  const note = optionalString(entry.note, `${field}.note`) ?? null;
  // A missing result is stated as missing, with no value, and never becomes a zero (SRS 17.15)
  if (reportingStatus === 'NOT_REPORTED') return { reportingStatus, note, ...EMPTY_VALUE };

  const { kpi } = assignment;
  const columns = kpi.measurementType === 'MONEY' ? await parseMoney(kpi, entry, period, field) : parseMeasuredValue(kpi, entry, field, { requireParts: true });
  return { reportingStatus, note, ...EMPTY_VALUE, ...columns };
};

/**
 * Save several results at once. Nothing is saved if any of them is invalid.
 */
export const saveValues = async (reportId, { values } = {}, actor) => {
  const report = await prisma.performanceReport.findUnique({
    where: { id: parseUuid(reportId, 'id') },
    include: { contract: { select: { id: true, officeId: true } }, reportingPeriod: true },
  });
  if (!report) throw notFound('Report not found');
  await assertOfficeAuthority(actor, PERMISSIONS.REPORT_CREATE, report.contract.officeId);
  await assertPeriodOpen(report.reportingPeriodId);
  if (!EDITABLE_STATUSES.includes(report.status)) throw conflict(`A ${report.status} report cannot be edited`);
  if (!Array.isArray(values) || values.length === 0) throw badRequest('values must be a non-empty list');

  const due = new Map((await dueAssignments(report.contractId, report.reportingPeriod)).map((assignment) => [assignment.id, assignment]));
  const rows = [];
  for (const [index, entry] of values.entries()) {
    const field = `values[${index}]`;
    const assignment = due.get(parseUuid(entry?.assignmentId, `${field}.assignmentId`));
    if (!assignment) throw badRequest(`${field}: this KPI is not reported in this period`);
    if (!isDirectEntry(assignment, report.reportingPeriod)) throw badRequest(`${field}: ${assignment.kpi.code} is reported by its own periods and adds up here automatically`);
    rows.push({ assignmentId: assignment.id, ...(await parseEntry(assignment, entry, report.reportingPeriod, field)) });
  }
  if (new Set(rows.map((row) => row.assignmentId)).size !== rows.length) throw badRequest('A KPI can appear only once in values');

  const saved = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const { assignmentId, ...data } of rows) {
      const update = { ...data, enteredByPersonId: actor.personId };
      results.push(
        await tx.performanceValue.upsert({
          where: { reportId_assignmentId_contributionType: { reportId: report.id, assignmentId, contributionType: 'DIRECT' } },
          update,
          create: { reportId: report.id, assignmentId, contributionType: 'DIRECT', ...update },
        })
      );
    }
    await tx.performanceReport.update({
      where: { id: report.id },
      data: { preparedByPersonId: actor.personId, status: report.status === 'NOT_STARTED' ? 'DRAFT' : report.status },
    });
    return results;
  });

  await auditAction(actor, { action: 'RESULTS_ENTERED', entityType: 'performance_report', entityId: report.id, newValues: { values: rows } });
  return saved;
};

export default { EDITABLE_STATUSES, saveValues };
