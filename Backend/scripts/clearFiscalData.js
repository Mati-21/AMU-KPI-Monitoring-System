import 'dotenv/config';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';

/**
 * Remove every fiscal year and contract, with all that hangs from them: reporting periods, KPI assignments, reports,
 * scores, and the notifications about them. KPIs, offices, people, roles, settings, documents and system logs stay.
 * It only shows what it would remove, unless run with --yes. Refused in production.
 */

// Children first, so nothing is removed while something still points at it
const TABLES = [
  ['Contract scores', 'contractScore'],
  ['KPI achievements', 'kpiAchievement'],
  ['Performance evidence links', 'performanceEvidence'],
  ['Performance reviews', 'performanceReview'],
  ['Performance values', 'performanceValue'],
  ['Performance reports', 'performanceReport'],
  ['Change request evidence links', 'changeRequestEvidence'],
  ['Change requests', 'assignmentChangeRequest'],
  ['Baseline evidence links', 'baselineEvidence'],
  ['Target shares', 'responsibilityAllocation'],
  ['KPI baselines', 'kpiBaseline'],
  ['KPI targets', 'kpiTarget'],
  ['KPI weights', 'kpiWeight'],
  ['KPI assignments', 'kpiAssignment'],
  ['Contract rejections', 'contractRejection'],
  ['Contracts', 'performanceContract'],
  ['Reporting periods', 'reportingPeriod'],
  ['Fiscal years', 'fiscalYear'],
];

// Notifications point at their record by id only, so they have to be found through those records
const notificationsAbout = async (db) => {
  const models = ['performanceContract', 'kpiAssignment', 'performanceReport', 'assignmentChangeRequest', 'reportingPeriod', 'fiscalYear'];
  const rows = await Promise.all(models.map((model) => db[model].findMany({ select: { id: true } })));
  return { entityId: { in: rows.flat().map((row) => row.id) } };
};

export const countFiscalData = async (db = prisma) => {
  const counts = await Promise.all(TABLES.map(async ([label, model]) => [label, await db[model].count()]));
  return [...counts, ['Notifications about them', await db.notification.count({ where: await notificationsAbout(db) })]];
};

export const clearFiscalData = async (db) => {
  await db.notification.deleteMany({ where: await notificationsAbout(db) });
  for (const [, model] of TABLES) await db[model].deleteMany();
};

const print = (counts) => counts.forEach(([label, count]) => console.log(`  ${label.padEnd(32)} ${count}`));

const main = async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('This script does not run in production.');

  const counts = await countFiscalData();
  if (!process.argv.includes('--yes')) {
    console.log('Would remove:');
    print(counts);
    console.log('\nNothing was removed. To remove all of this for good: npm run clear:fiscal:confirm');
    return;
  }

  await prisma.$transaction(clearFiscalData, { timeout: 120000 });
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
