import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';

/**
 * Seed measurement units and stage and category scales from config/scales-units.json. Only missing rows are created,
 * matched by name, so later edits are kept. Safe to run repeatedly. Scale scoring starts unapproved.
 */
const data = JSON.parse(readFileSync(new URL('../config/scales-units.json', import.meta.url), 'utf8'));

export const seedScalesUnits = async (db = prisma) => {
  const units = new Set((await db.measurementUnit.findMany({ select: { name: true } })).map((unit) => unit.name));
  const newUnits = data.measurementUnits.filter((unit) => !units.has(unit.name));
  if (newUnits.length > 0) await db.measurementUnit.createMany({ data: newUnits, skipDuplicates: true });

  const scales = new Set((await db.kpiScale.findMany({ select: { name: true } })).map((scale) => scale.name));
  const newScales = data.scales.filter((scale) => !scales.has(scale.name));
  for (const { levels, ...scale } of newScales) await db.kpiScale.create({ data: { ...scale, levels: { create: levels } } });

  return {
    unitsAdded: newUnits.map((unit) => unit.name),
    unitsKept: data.measurementUnits.length - newUnits.length,
    scalesAdded: newScales.map((scale) => scale.name),
    scalesKept: data.scales.length - newScales.length,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedScalesUnits()
    .then(({ unitsAdded, unitsKept, scalesAdded, scalesKept }) => {
      console.log(`✅ Units: ${unitsAdded.length} added${unitsAdded.length ? ` (${unitsAdded.join(', ')})` : ''}, ${unitsKept} already present`);
      console.log(`✅ Scales: ${scalesAdded.length} added${scalesAdded.length ? ` (${scalesAdded.join(', ')})` : ''}, ${scalesKept} already present`);
      if (scalesAdded.length) console.log('   Scale scoring starts unapproved. Approve it in KPI Management > Scales after checking the scores.');
    })
    .catch((error) => {
      console.error('❌ Seeding scales and units failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
