import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';

import { prisma } from '../config/database.js';
import { activateFiscalYear, closeFiscalYear, createFiscalYear } from '../modules/04-kpi-catalog/fiscalYear.service.js';
import { generatePeriods } from '../modules/06-reporting-periods/period.service.js';
import { fromEthiopian } from '../utils/ethiopianDate.js';
import { buildOfficeContracts, buildStaffContracts } from './demo/contracts.js';
import { buildHistory } from './demo/history.js';
import { buildOffices, buildPeople, printLogins } from './demo/university.js';
import { actorFor, seedBase } from './seedBase.js';

/**
 * npm run seed:demo — wipe the whole system and build a demo university with a year of history:
 *   1. the base (npm run seed:base): reference data, themes and 30 KPIs;
 *   2. 12 offices, a head for each, three staff in each office at the bottom, and the Super Admin;
 *   3. 2018 E.C., now closed: every office contract signed, a staff contract for every staff member and for each
 *      bottom office's head, and every monthly, quarterly, semi-annual and annual period reported and approved,
 *      from the bottom up;
 *   4. 2019 E.C. in planning, with its reporting periods and no contracts yet.
 * Everything is deleted first, including every person and the Super Admin. It asks before it starts, unless run with
 * --yes.
 */

const UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const DAY = 86400000;

const confirmed = async () => {
  if (process.argv.includes('--yes')) return true;
  console.log('This deletes EVERYTHING in the database (every person, office, KPI, contract and report, and the Super Admin)');
  console.log('and builds the demo university with a year of history.');
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question('Type yes to go ahead: ');
  prompt.close();
  return answer.trim().toLowerCase() === 'yes';
};

const emptyUploads = () => {
  if (!fs.existsSync(UPLOADS)) return 0;
  let removed = 0;
  for (const folder of fs.readdirSync(UPLOADS)) {
    const dir = path.join(UPLOADS, folder);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, file), { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
};

const wipe = async () => {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((row) => `"${row.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`🧹 Emptied ${tables.length} tables and ${emptyUploads()} uploaded files`);
};

/**
 * An Ethiopian fiscal year, Meskerem 1 to the last day of Pagume, with periods of every frequency.
 */
const createYear = async (ecYear, admin) => {
  const day = (date) => date.toISOString().slice(0, 10);
  const startDate = fromEthiopian(ecYear, 1, 1);
  const endDate = new Date(fromEthiopian(ecYear + 1, 1, 1).getTime() - DAY);
  const year = await createFiscalYear({ name: `${ecYear} E.C.`, startDate: day(startDate), endDate: day(endDate) }, admin);
  for (const frequency of await prisma.reportingFrequency.findMany({ where: { isCustom: false } })) await generatePeriods(year.id, { frequencyId: frequency.id }, admin);
  return { ...year, range: `${day(startDate)} to ${day(endDate)}` };
};

const main = async () => {
  if (!(await confirmed())) {
    console.log('Nothing was changed.');
    return;
  }
  const started = Date.now();
  await wipe();
  const offices = await buildOffices();
  const people = await buildPeople(offices);
  const admin = await actorFor(people.admin, 'seed:demo');
  const { kpis } = await seedBase({ actor: admin });

  // Last year: planned, signed, reported all year, then closed
  const past = await createYear(2018, admin);
  await activateFiscalYear(past.id, admin);
  const actors = await buildOfficeContracts(past, offices, people, kpis);
  const staffContracts = await buildStaffContracts(past, offices, people, kpis, actors);
  console.log(`📝 2018 E.C.: ${await prisma.performanceContract.count({ where: { personId: null } })} office contracts and ${staffContracts} staff contracts, all signed`);
  const reports = await buildHistory(past, people, offices, admin);
  await closeFiscalYear(past.id, { reason: 'The year ended and every report is approved' }, admin);
  console.log(`📅 2018 E.C. (${past.range}) closed with ${reports} approved reports`);

  // This year: being planned
  const next = await createYear(2019, admin);
  console.log(`📅 2019 E.C. (${next.range}) in planning, with its reporting periods and no contracts yet`);

  printLogins(people);
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)} seconds.`);
};

main()
  .catch((error) => {
    console.error('\n❌ Demo seed failed:', error.message, error.details ?? '');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
