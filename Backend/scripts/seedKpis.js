import 'dotenv/config';
import { prisma } from '../config/database.js';

/**
 * Seed KPIs & Fiscal Planning Skeleton
 * Tailored for the 2026 schema (FiscalYear + KpiTheme + Kpi + EvalCycle)
 */
export const seedKpis = async () => {
  console.log('🌱 Seed KPIs script starter skeleton ready to implement.');
};

seedKpis()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
