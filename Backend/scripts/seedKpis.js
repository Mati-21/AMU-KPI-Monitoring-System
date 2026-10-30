import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import { createKpi } from '../modules/04-kpi-catalog/kpi.service.js';

/**
 * Seed the sample catalog from config/kpi-samples.json (one KPI per measurement type, taken from the SRS examples).
 * Run seed:admin first for the reference data. Existing codes are skipped, so it is safe to run repeatedly.
 * KPIs go through the same validation as the API.
 */
const samples = JSON.parse(readFileSync(new URL('../config/kpi-samples.json', import.meta.url), 'utf8'));

const SEED_ACTOR = { personId: null, access: { canGlobally: () => true } };

const idOf = async (model, where, label) => {
  const row = await model.findFirst({ where, select: { id: true } });
  if (!row) throw new Error(`${label} not found. Run npm run seed:admin first.`);
  return row.id;
};

export const seedKpis = async () => {
  for (const objective of samples.objectives) {
    await prisma.strategicObjective.upsert({ where: { code: objective.code }, update: {}, create: objective });
  }
  for (const theme of samples.themes) {
    await prisma.kpiTheme.upsert({ where: { code: theme.code }, update: {}, create: theme });
  }

  let added = 0;
  for (const { theme, objective, frequency, unit, scale, currency, ...kpi } of samples.kpis) {
    if (await prisma.kpi.findUnique({ where: { code: kpi.code } })) continue;
    await createKpi(
      {
        ...kpi,
        themeId: await idOf(prisma.kpiTheme, { code: theme }, `Theme ${theme}`),
        strategicObjectiveId: await idOf(prisma.strategicObjective, { code: objective }, `Objective ${objective}`),
        defaultFrequencyId: await idOf(prisma.reportingFrequency, { name: frequency }, `Frequency ${frequency}`),
        ...(unit && { unitId: await idOf(prisma.measurementUnit, { name: unit }, `Unit ${unit}`) }),
        ...(scale && { scaleId: await idOf(prisma.kpiScale, { name: scale }, `Scale ${scale}`) }),
        ...(currency && { currencyId: await idOf(prisma.currency, { code: currency }, `Currency ${currency}`) }),
      },
      SEED_ACTOR
    );
    added += 1;
  }
  console.log(`✅ Sample KPIs: ${added} added, ${samples.kpis.length - added} already present`);
  return { added };
};

// Run directly (npm run seed:kpis), but not when imported.
// Compare case-insensitively on Windows, where the drive letter case can differ (c:\ vs C:\).
const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedKpis()
    .catch((error) => {
      console.error('❌ KPI seeding failed:', error.message, error.details ?? '');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedKpis;
