import 'dotenv/config';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import { refreshReconciliation } from '../modules/05-contract-cascading/allocation.service.js';

/**
 * Remove contracts, so a scenario can be set up and tested again. Everything that hangs from a contract goes with it:
 * its KPIs with baselines, targets, weights and shares, change requests, reports, reported values, results, scores,
 * and the notifications about them. Fiscal years, reporting periods, KPIs, offices, people, roles, settings, documents
 * and system logs stay.
 *
 *   --year "2019 E.C."   only the contracts of that fiscal year (its name, or its id). Without it, every year.
 *   --unreported         only contracts nothing was reported on, so approved results are kept
 *   --yes                really remove it. Without it, this only shows what would go.
 *
 * Contracts hand KPIs down to each other, so what is removed always includes the contracts below: a contract is never
 * left holding a KPI whose source is gone. With --unreported, a contract is kept instead when anything reported sits
 * below it. Refused in production.
 */

const argOf = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
};
const unreportedOnly = process.argv.includes('--unreported');

const idsOf = (rows) => rows.map((row) => row.id);

const findYear = async (value) => {
  const year = await prisma.fiscalYear.findFirst({ where: { OR: [{ name: value }, ...(/^[0-9a-f-]{36}$/i.test(value) ? [{ id: value }] : [])] }, select: { id: true, name: true } });
  if (!year) {
    const names = (await prisma.fiscalYear.findMany({ select: { name: true }, orderBy: { startDate: 'asc' } })).map((row) => row.name).join(', ');
    throw new Error(`There is no fiscal year "${value}". Fiscal years: ${names || 'none'}`);
  }
  return year;
};

/**
 * The contracts to remove, closed over the KPIs handed down: a contract's KPIs reach other contracts through their
 * parent (the office below) or their source (a person in the office).
 */
const chooseContracts = async (db, year) => {
  const where = { ...(year ? { fiscalYearId: year.id } : {}), ...(unreportedOnly ? { reports: { none: {} } } : {}) };
  let chosen = new Set(idsOf(await db.performanceContract.findMany({ where, select: { id: true } })));

  for (;;) {
    const links = await db.kpiAssignment.findMany({
      where: { OR: [{ parent: { contractId: { in: [...chosen] } } }, { source: { contractId: { in: [...chosen] } } }] },
      select: { contractId: true, parent: { select: { contractId: true } }, source: { select: { contractId: true } } },
    });
    const outside = links.filter((link) => !chosen.has(link.contractId));
    if (outside.length === 0) return chosen;

    if (unreportedOnly) {
      // Something below is kept, so the contract above it stays too
      const above = new Set(outside.map((link) => link.parent?.contractId ?? link.source?.contractId));
      chosen = new Set([...chosen].filter((id) => !above.has(id)));
    } else {
      for (const link of outside) chosen.add(link.contractId);
    }
  }
};

// Children first, so nothing is removed while something still points at it
const tables = (contractIds, assignmentIds) => {
  const onAssignments = { assignmentId: { in: assignmentIds } };
  return [
    ['Contract scores', 'contractScore', { contractId: { in: contractIds } }],
    ['KPI achievements', 'kpiAchievement', onAssignments],
    ['Evidence links on results', 'performanceEvidence', { performanceValue: onAssignments }],
    ['Performance reviews', 'performanceReview', { report: { contractId: { in: contractIds } } }],
    ['Reported values', 'performanceValue', onAssignments],
    ['Performance reports', 'performanceReport', { contractId: { in: contractIds } }],
    ['Change request evidence links', 'changeRequestEvidence', { changeRequest: onAssignments }],
    ['Change requests', 'assignmentChangeRequest', onAssignments],
    ['Baseline evidence links', 'baselineEvidence', { baseline: onAssignments }],
    ['Target shares', 'responsibilityAllocation', { OR: [{ parentAssignmentId: { in: assignmentIds } }, { childAssignmentId: { in: assignmentIds } }] }],
    ['KPI baselines', 'kpiBaseline', onAssignments],
    ['KPI targets', 'kpiTarget', onAssignments],
    ['KPI weights', 'kpiWeight', onAssignments],
    ['KPIs on contracts', 'kpiAssignment', { id: { in: assignmentIds } }],
    ['Contract rejections', 'contractRejection', { contractId: { in: contractIds } }],
    ['Contracts', 'performanceContract', { id: { in: contractIds } }],
  ];
};

// Notifications point at their record by id only, so they are found through those records
const notificationsAbout = async (db, contractIds, assignmentIds) => {
  const [reports, requests] = await Promise.all([
    db.performanceReport.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } }),
    db.assignmentChangeRequest.findMany({ where: { assignmentId: { in: assignmentIds } }, select: { id: true } }),
  ]);
  return { entityId: { in: [...contractIds, ...assignmentIds, ...idsOf(reports), ...idsOf(requests)] } };
};

const plan = async (db, year) => {
  const contractIds = [...(await chooseContracts(db, year))];
  const assignmentIds = idsOf(await db.kpiAssignment.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } }));
  return { contractIds, assignmentIds };
};

export const countContracts = async (db, { contractIds, assignmentIds }) => {
  const counts = await Promise.all(tables(contractIds, assignmentIds).map(async ([label, model, where]) => [label, await db[model].count({ where })]));
  return [...counts, ['Notifications about them', await db.notification.count({ where: await notificationsAbout(db, contractIds, assignmentIds) })]];
};

export const clearContracts = async (db, { contractIds, assignmentIds }) => {
  // KPIs outside the removed contracts that took a share from them lose it, and are rechecked afterwards
  const parents = await db.kpiAssignment.findMany({ where: { id: { in: assignmentIds } }, select: { parentAssignmentId: true } });
  const outsideParents = [...new Set(parents.map((row) => row.parentAssignmentId).filter((id) => id && !assignmentIds.includes(id)))];

  await db.notification.deleteMany({ where: await notificationsAbout(db, contractIds, assignmentIds) });
  // The removed KPIs point at each other within their own table
  await db.kpiAssignment.updateMany({ where: { id: { in: assignmentIds } }, data: { parentAssignmentId: null, sourceAssignmentId: null } });
  for (const [, model, where] of tables(contractIds, assignmentIds)) await db[model].deleteMany({ where });
  return outsideParents;
};

const print = (counts) => counts.forEach(([label, count]) => console.log(`  ${label.padEnd(32)} ${count}`));

const main = async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('This script does not run in production.');
  if (process.argv.includes('--year') && !argOf('--year')) throw new Error('--year needs a fiscal year name, such as --year "2019 E.C."');

  const year = argOf('--year') ? await findYear(argOf('--year')) : null;
  const chosen = await plan(prisma, year);
  const scope = `${year ? `in ${year.name}` : 'in every fiscal year'}${unreportedOnly ? ', with nothing reported on them' : ''}`;

  if (chosen.contractIds.length === 0) {
    console.log(`There are no contracts ${scope}. Nothing to remove.`);
    return;
  }

  const counts = await countContracts(prisma, chosen);
  if (!process.argv.includes('--yes')) {
    console.log(`Would remove ${chosen.contractIds.length} contract(s) ${scope}:`);
    print(counts);
    console.log('\nNothing was removed. To remove all of this for good, run the same command with --yes (or npm run clear:contracts:confirm -- <the same options>).');
    return;
  }

  const outsideParents = await prisma.$transaction((tx) => clearContracts(tx, chosen), { timeout: 120000 });
  // The KPIs above that were shared into these contracts are no longer fully shared
  for (const id of outsideParents) await refreshReconciliation(id);
  console.log(`Removed ${chosen.contractIds.length} contract(s) ${scope}:`);
  print(counts);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
