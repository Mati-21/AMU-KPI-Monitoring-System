import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { auditAction } from '../../utils/auditLogger.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../../utils/httpError.js';
import { parseUuid } from '../../utils/validation.js';
import { assertFiscalYearOpen } from '../04-kpi-catalog/fiscalYear.service.js';
import { buildDefinition } from '../04-kpi-catalog/kpi.service.js';
import { nameKey, similarNamesIn } from '../04-kpi-catalog/kpiNames.js';
import { getSetting } from '../10-system-governance/system.service.js';
import { assertAuthorityFromAbove, frequencyProblem } from './contract.shared.js';
import { parseBaseline, parseTarget, parseWeight } from './measurement.js';

/**
 * Module 05 — Register KPIs straight into the top office's self contract from one file. Each row is a KPI with its
 * baseline, target and weight. A row naming a KPI that is already registered reuses it instead of registering it
 * again, and a name close to an existing one waits until someone says which it is. All rows are saved, or none.
 */

const MAX_ROWS = 500;
const KPI_WITH_SCALE = { scale: { include: { levels: true } } };

const loadContract = async (id, actor) => {
  const contract = await prisma.performanceContract.findUnique({ where: { id: parseUuid(id, 'id') } });
  if (!contract) throw notFound('Contract not found');
  if (contract.assigningOfficeId) throw conflict('New KPIs can be registered only into the top office\'s self contract');
  await assertFiscalYearOpen(contract.fiscalYearId);
  await assertAuthorityFromAbove(actor, PERMISSIONS.CONTRACT_MANAGE, contract);
  if (contract.status !== 'DRAFT') throw conflict(`KPIs can be added only while the self contract is a draft; this one is ${contract.status}`);
  return contract;
};

const problemsOf = (failure) => {
  if (!(failure instanceof HttpError)) throw failure;
  return failure.details?.errors ?? [failure.message];
};

// A level is written by its name in the file
const withLevel = (kpi, input = {}, field) => {
  if (!input.level) return input;
  const level = kpi.scale?.levels.find((candidate) => nameKey(candidate.name) === nameKey(input.level));
  if (!level) throw badRequest(`${field} "${input.level}" is not a level of scale "${kpi.scale?.name ?? 'none'}"`);
  return { ...input, scaleLevelId: level.id };
};

const differences = (row, kpi) =>
  [
    ['measurementType', 'Measurement type'],
    ['direction', 'Direction'],
    ['unitId', 'Unit'],
    ['currencyId', 'Currency'],
    ['scaleId', 'Scale'],
  ]
    .filter(([key]) => row[key] && row[key] !== kpi[key])
    .map(([, label]) => `${label} in the file differs from KPI Management, so the registered KPI is used as it is`);

/**
 * Work out what one row would do, without saving anything.
 */
const resolveRow = async (row, index, context) => {
  const result = { index, name: row?.kpi?.name ?? '', status: 'ERROR', errors: [], warnings: [], candidates: [] };
  const name = row?.kpi?.name?.trim();
  if (!name) return { ...result, errors: ['Name is empty'] };
  const key = nameKey(name);
  if (context.namesInFile.has(key)) result.errors.push(`"${name}" appears more than once in this file`);
  context.namesInFile.add(key);

  const chosenId = row.decision && row.decision !== 'new' ? row.decision : null;
  const existing = context.catalog.find((kpi) => (chosenId ? kpi.id === chosenId : nameKey(kpi.name) === key));
  let kpi;
  if (existing) {
    kpi = existing;
    result.status = 'EXISTING';
    result.kpi = { id: kpi.id, name: kpi.name };
    result.warnings.push(...differences(row.kpi, kpi));
  } else if (chosenId) {
    return { ...result, errors: [...result.errors, 'The KPI chosen for this row is no longer active'] };
  } else {
    const similar = similarNamesIn(context.catalog, name);
    if (similar.length > 0 && row.decision !== 'new') {
      return { ...result, status: 'POSSIBLE_DUPLICATE', candidates: similar.map(({ id, name: candidate }) => ({ id, name: candidate })) };
    }
    // Problems found while reading the file only matter for a KPI that has to be registered
    if (row.kpiErrors?.length > 0) return { ...result, errors: [...result.errors, ...row.kpiErrors] };
    try {
      result.definition = await buildDefinition(row.kpi);
      kpi = { ...result.definition, scale: result.definition.scaleId ? await prisma.kpiScale.findUnique({ where: { id: result.definition.scaleId }, include: { levels: true } }) : null };
      result.status = 'NEW';
    } catch (failure) {
      return { ...result, errors: [...result.errors, ...problemsOf(failure)] };
    }
  }

  if (kpi.id && context.onContract.has(kpi.id)) {
    result.errors.push(context.onContract.get(kpi.id) === 'CANCELLED' ? 'This KPI was cancelled on this contract. Add it back with Add KPI' : 'This KPI is already on this contract');
  }
  try {
    result.baseline = parseBaseline(kpi, withLevel(kpi, row.baseline, 'Baseline'));
  } catch (failure) {
    result.errors.push(...problemsOf(failure));
  }
  try {
    result.target = parseTarget(kpi, withLevel(kpi, row.target, 'Target'));
  } catch (failure) {
    result.errors.push(...problemsOf(failure));
  }
  try {
    result.weight = parseWeight(row.weight);
  } catch (failure) {
    result.errors.push(...problemsOf(failure));
  }
  result.reportingFrequencyId = row.kpi?.defaultFrequencyId ?? kpi.defaultFrequencyId;
  const problem = result.reportingFrequencyId ? await context.frequencyProblem(result.reportingFrequencyId) : 'Reporting Frequency is empty';
  if (problem) result.errors.push(problem);
  result.isAdditive = kpi.isAdditive;
  if (result.errors.length > 0) result.status = 'ERROR';
  return result;
};

const publicRow = ({ definition, baseline, target, reportingFrequencyId, isAdditive, ...row }) => row;

/**
 * Check every row and, unless dryRun, save them all: new KPIs into KPI Management and every row onto the contract.
 * rows[].decision settles a possible duplicate: an existing KPI's id to reuse it, or 'new' to register it anyway.
 */
export const importIntoContract = async (id, { rows, dryRun = false } = {}, actor) => {
  const contract = await loadContract(id, actor);
  if (!Array.isArray(rows) || rows.length === 0) throw badRequest('rows must list at least one KPI');
  if (rows.length > MAX_ROWS) throw badRequest(`A file can hold at most ${MAX_ROWS} KPIs`);

  const [catalog, onContract, weights] = await Promise.all([
    prisma.kpi.findMany({ where: { isActive: true }, include: KPI_WITH_SCALE }),
    prisma.kpiAssignment.findMany({ where: { contractId: contract.id }, select: { kpiId: true, status: true } }),
    prisma.kpiWeight.findMany({ where: { isCurrent: true, assignment: { contractId: contract.id, status: { not: 'CANCELLED' } } }, select: { weight: true } }),
  ]);
  // Each frequency is looked up once for the whole file
  const frequencyChecks = new Map();
  const checkFrequency = (frequencyId) => {
    if (!frequencyChecks.has(frequencyId)) frequencyChecks.set(frequencyId, frequencyProblem(contract.fiscalYearId, frequencyId));
    return frequencyChecks.get(frequencyId);
  };
  const context = { catalog, onContract: new Map(onContract.map((row) => [row.kpiId, row.status])), namesInFile: new Set(), frequencyProblem: checkFrequency };
  const resolved = [];
  for (const [index, row] of rows.entries()) resolved.push(await resolveRow(row, index, context));

  const count = (status) => resolved.filter((row) => row.status === status).length;
  const weightNow = weights.reduce((sum, row) => sum + Number(row.weight), 0);
  const summary = {
    total: rows.length,
    newKpis: count('NEW'),
    existingKpis: count('EXISTING'),
    possibleDuplicates: count('POSSIBLE_DUPLICATE'),
    withErrors: count('ERROR'),
    // Every row in the file counts, settled or not, so the total shows where the contract will end up
    weightAfter: Math.round((weightNow + rows.reduce((sum, row) => sum + (Number.isFinite(Number(row?.weight)) ? Number(row.weight) : 0), 0)) * 10000) / 10000,
    requiredTotalWeight: Number(contract.requiredTotalWeight),
  };
  if (summary.newKpis > 0 && !actor.access.canGlobally(PERMISSIONS.KPI_CREATE)) throw forbidden('Registering new KPIs needs university-wide kpi:create authority');
  if (dryRun) return { summary, rows: resolved.map(publicRow) };
  if (summary.withErrors > 0 || summary.possibleDuplicates > 0) throw badRequest('Some rows still need attention, so nothing was saved', { summary, rows: resolved.map(publicRow) });

  const personId = actor.personId;
  const maxOverAllocationPercent = await getSetting('kpi', 'default_max_over_allocation_percent');
  const saved = await prisma.$transaction(
    async (tx) => {
      const results = [];
      for (const row of resolved) {
        const kpi = row.status === 'NEW' ? await tx.kpi.create({ data: { ...row.definition, createdByPersonId: personId } }) : { id: row.kpi.id };
        const assignment = await tx.kpiAssignment.create({
          data: {
            contractId: contract.id,
            kpiId: kpi.id,
            reportingFrequencyId: row.reportingFrequencyId,
            scopeRelation: row.isAdditive ? 'EXCLUSIVE_COMPLETE' : 'OVERLAPPING',
            maxOverAllocationPercent,
            createdByPersonId: personId,
            baselines: { create: { ...row.baseline, createdByPersonId: personId } },
            targets: { create: { ...row.target, createdByPersonId: personId } },
            weights: { create: { weight: row.weight, createdByPersonId: personId } },
          },
        });
        results.push({ row, kpi, assignment });
      }
      return results;
    },
    { timeout: 120000 }
  );

  for (const { row, kpi, assignment } of saved) {
    if (row.status === 'NEW') await auditAction(actor, { action: 'KPI_CREATED', entityType: 'kpi', entityId: kpi.id, newValues: row.definition });
    await auditAction(actor, { action: 'ASSIGNMENT_CREATED', entityType: 'kpi_assignment', entityId: assignment.id, newValues: { contractId: contract.id, kpiId: kpi.id, baseline: row.baseline, target: row.target, weight: row.weight } });
  }
  return { summary, rows: resolved.map(publicRow) };
};

export default { importIntoContract };
