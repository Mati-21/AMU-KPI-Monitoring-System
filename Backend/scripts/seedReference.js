import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';

/**
 * Seed starting reference data from config/reference.json. Only missing rows are created,
 * so later edits by the university are kept. Safe to run repeatedly.
 */
const reference = JSON.parse(readFileSync(new URL('../config/reference.json', import.meta.url), 'utf8'));

const createMissing = async (model, rows, key) => {
  const existing = new Set((await model.findMany({ select: { [key]: true } })).map((row) => row[key]));
  const missing = rows.filter((row) => !existing.has(row[key]));
  if (missing.length > 0) await model.createMany({ data: missing, skipDuplicates: true });
  return missing.length;
};

export const seedReference = async () => {
  const added = {
    currencies: await createMissing(prisma.currency, reference.currencies, 'code'),
    units: await createMissing(prisma.measurementUnit, reference.measurementUnits, 'name'),
    frequencies: await createMissing(prisma.reportingFrequency, reference.reportingFrequencies, 'name'),
    thresholds: await createMissing(prisma.performanceStatusThreshold, reference.statusThresholds, 'name'),
    documentTypes: await createMissing(prisma.documentType, reference.documentTypes, 'name'),
    scales: 0,
  };

  for (const { levels, ...scale } of reference.scales) {
    const existing = await prisma.kpiScale.findUnique({ where: { name: scale.name } });
    if (existing) continue;
    await prisma.kpiScale.create({ data: { ...scale, levels: { create: levels } } });
    added.scales += 1;
  }

  console.log(`✅ Reference data: ${Object.entries(added).map(([name, count]) => `${count} ${name}`).join(', ')} added`);
  return added;
};

// Run directly (npm run seed:reference), but not when imported by seedAdmin.js.
// Compare case-insensitively on Windows, where the drive letter case can differ (c:\ vs C:\).
const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedReference()
    .catch((error) => {
      console.error('❌ Reference seeding failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedReference;
