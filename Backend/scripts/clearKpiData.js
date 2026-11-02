import 'dotenv/config';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';

/**
 * Remove every KPI, so they can be registered again in mass. Everything that uses a KPI goes with it: its place on
 * contracts with baselines, targets, weights and shares, change requests, reported values, results and scores.
 * Contracts, reports, fiscal years and reporting periods stay, without KPIs on them.
 * With --with-catalog the lists KPIs are built from go too: themes, units, scales and
 * currencies. Reporting frequencies always stay, because reporting periods are made from them.
 * It only shows what it would remove, unless run with --yes. Refused in production.
 */

const withCatalog = process.argv.includes('--with-catalog');

// Children first, so nothing is removed while something still points at it
const KPI_TABLES = [
  ['Contract scores', 'contractScore'],
  ['KPI results', 'kpiAchievement'],
  ['Evidence links on results', 'performanceEvidence'],
  ['Reported values', 'performanceValue'],
  ['Change request evidence links', 'changeRequestEvidence'],
  ['Change requests', 'assignmentChangeRequest'],
  ['Baseline evidence links', 'baselineEvidence'],
  ['Target shares', 'responsibilityAllocation'],
  ['KPI baselines', 'kpiBaseline'],
  ['KPI targets', 'kpiTarget'],
  ['KPI weights', 'kpiWeight'],
  ['KPIs on contracts', 'kpiAssignment'],
  ['KPIs', 'kpi'],
];

const CATALOG_TABLES = [
  ['Exchange rates', 'exchangeRate'],
  ['Currencies', 'currency'],
  ['Scale levels', 'kpiScaleLevel'],
  ['Scales', 'kpiScale'],
  ['Units', 'measurementUnit'],
  ['Themes', 'kpiTheme'],
];

const tables = () => (withCatalog ? [...KPI_TABLES, ...CATALOG_TABLES] : KPI_TABLES);

// Notifications point at their record by id only, so they have to be found through those records
const notificationsAbout = async (db) => {
  const rows = await Promise.all(['kpi', 'kpiAssignment', 'assignmentChangeRequest'].map((model) => db[model].findMany({ select: { id: true } })));
  return { entityId: { in: rows.flat().map((row) => row.id) } };
};

export const countKpiData = async (db = prisma) => {
  const counts = await Promise.all(tables().map(async ([label, model]) => [label, await db[model].count()]));
  return [...counts, ['Notifications about them', await db.notification.count({ where: await notificationsAbout(db) })]];
};

export const clearKpiData = async (db) => {
  await db.notification.deleteMany({ where: await notificationsAbout(db) });
  // KPIs and themes point at each other within their own table
  await db.kpiAssignment.updateMany({ data: { parentAssignmentId: null } });
  await db.kpi.updateMany({ data: { replacesKpiId: null } });
  if (withCatalog) await db.kpiTheme.updateMany({ data: { parentThemeId: null } });
  for (const [, model] of tables()) await db[model].deleteMany();
};

const print = (counts) => counts.forEach(([label, count]) => console.log(`  ${label.padEnd(32)} ${count}`));

const main = async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('This script does not run in production.');

  const counts = await countKpiData();
  if (!process.argv.includes('--yes')) {
    console.log(`Would remove${withCatalog ? ' (with the KPI catalog lists)' : ''}:`);
    print(counts);
    console.log(`\nNothing was removed. To remove all of this for good: npm run ${withCatalog ? 'clear:kpis:all:confirm' : 'clear:kpis:confirm'}`);
    return;
  }

  await prisma.$transaction(clearKpiData, { timeout: 120000 });
  console.log('Removed:');
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
