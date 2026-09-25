import { prisma } from '../config/database.js';
import { getCurrentCycleYear } from '../utils/kpiCycle.js';

const now = () => new Date();

const kpiSeedList = [
  // Theme 1: Research & Community Engagement
  {
    theme: 'Research & Community Engagement',
    subTheme: 'Publications & Citations',
    kpiName: 'Peer-Reviewed Journal Articles Published',
    unitName: 'Count',
    unitCode: 'CNT',
    weight: 15.0,
    baseline: 50,
    target: 120,
    description: 'Total number of peer-reviewed articles published in recognized journals',
    isEvidenceRequired: true,
  },
  {
    theme: 'Research & Community Engagement',
    subTheme: 'Publications & Citations',
    kpiName: 'Citations Count in Scopus and Web of Science',
    unitName: 'Count',
    unitCode: 'CNT',
    weight: 10.0,
    baseline: 200,
    target: 500,
    description: 'Total citation count across active faculty publications',
    isEvidenceRequired: false,
  },
  {
    theme: 'Research & Community Engagement',
    subTheme: 'Technology Transfer',
    kpiName: 'Community Outreach & Technology Transfer Projects',
    unitName: 'Count',
    unitCode: 'CNT',
    weight: 10.0,
    baseline: 8,
    target: 25,
    description: 'Implemented community development and tech-transfer projects',
    isEvidenceRequired: true,
  },

  // Theme 2: Academic Excellence & Quality
  {
    theme: 'Academic Excellence & Quality',
    subTheme: 'Program Accreditation',
    kpiName: 'Percentage of Accredited Degree Programs',
    unitName: 'Percentage',
    unitCode: 'PCT',
    weight: 15.0,
    baseline: 60,
    target: 90,
    description: 'Ratio of degree programs with national/international accreditation',
    isEvidenceRequired: true,
  },
  {
    theme: 'Academic Excellence & Quality',
    subTheme: 'Student Performance',
    kpiName: 'Student On-Time Graduation Rate',
    unitName: 'Percentage',
    unitCode: 'PCT',
    weight: 10.0,
    baseline: 75,
    target: 88,
    description: 'Percentage of undergraduate students graduating within expected program length',
    isEvidenceRequired: false,
  },
  {
    theme: 'Academic Excellence & Quality',
    subTheme: 'Staff Qualification',
    kpiName: 'Academic Staff Holding PhD Degrees',
    unitName: 'Percentage',
    unitCode: 'PCT',
    weight: 10.0,
    baseline: 30,
    target: 50,
    description: 'Proportion of full-time academic staff with PhD qualifications',
    isEvidenceRequired: true,
  },

  // Theme 3: Institutional Governance & Digitalization
  {
    theme: 'Institutional Governance & Digitalization',
    subTheme: 'Financial Execution',
    kpiName: 'Capital Budget Utilization Rate',
    unitName: 'Percentage',
    unitCode: 'PCT',
    weight: 10.0,
    baseline: 82,
    target: 98,
    description: 'Percentage of approved capital budget executed within the fiscal year',
    isEvidenceRequired: true,
  },
  {
    theme: 'Institutional Governance & Digitalization',
    subTheme: 'Digital Infrastructure',
    kpiName: 'Digital Library & E-Resource Access Count',
    unitName: 'Count',
    unitCode: 'CNT',
    weight: 5.0,
    baseline: 2000,
    target: 6000,
    description: 'Annual user sessions on institutional digital library database',
    isEvidenceRequired: false,
  },
  {
    theme: 'Institutional Governance & Digitalization',
    subTheme: 'Partnerships & Industry Linkages',
    kpiName: 'Active Industry & Academic MoUs Executed',
    unitName: 'Count',
    unitCode: 'CNT',
    weight: 10.0,
    baseline: 4,
    target: 15,
    description: 'Formal active partnerships signed and actively delivering outcomes',
    isEvidenceRequired: true,
  },
  {
    theme: 'Institutional Governance & Digitalization',
    subTheme: 'Student Satisfaction',
    kpiName: 'Overall Student Campus Satisfaction Index',
    unitName: 'Percentage',
    unitCode: 'PCT',
    weight: 5.0,
    baseline: 65,
    target: 85,
    description: 'Overall student satisfaction score from annual quality survey',
    isEvidenceRequired: false,
  },
];

const seedKpis = async () => {
  console.log('🚀 Seeding 10 Institutional KPIs...\n');

  try {
    const cycleYear = getCurrentCycleYear();
    console.log(`📌 Active Cycle Year: ${cycleYear}`);

    // Get an admin user to set as CreatedBy
    const adminUser = await prisma.users.findFirst({
      where: { Email: { equals: 'Mati@gmail.com', mode: 'insensitive' } },
    });
    const creatorId = adminUser?.Id || null;

    let seededCount = 0;

    for (const item of kpiSeedList) {
      // 1. Ensure Unit exists
      let unit = await prisma.units.findFirst({
        where: { Code: { equals: item.unitCode, mode: 'insensitive' } },
      });

      if (!unit) {
        unit = await prisma.units.create({
          data: {
            Name: item.unitName,
            Code: item.unitCode,
            Description: `${item.unitName} measurement unit`,
            CreatedAt: now(),
          },
        });
        console.log(`✅ Created Unit: ${unit.Name} (${unit.Code})`);
      }

      // 2. Ensure Theme (Top-Level KPIType)
      let themeType = await prisma.kPITypes.findFirst({
        where: { KPIName: { equals: item.theme, mode: 'insensitive' }, ParentKPIID: null },
      });

      if (!themeType) {
        themeType = await prisma.kPITypes.create({
          data: { KPIName: item.theme, ParentKPIID: null, CreatedAt: now() },
        });
        console.log(`✅ Created Theme: "${item.theme}"`);
      }

      // 3. Ensure Sub-Theme (Child KPIType)
      let subThemeType = await prisma.kPITypes.findFirst({
        where: { KPIName: { equals: item.subTheme, mode: 'insensitive' }, ParentKPIID: themeType.Id },
      });

      if (!subThemeType) {
        subThemeType = await prisma.kPITypes.create({
          data: { KPIName: item.subTheme, ParentKPIID: themeType.Id, CreatedAt: now() },
        });
        console.log(`✅ Created Sub-Theme: "${item.subTheme}"`);
      }

      // 4. Ensure KPI Category Node (Leaf KPIType)
      let kpiType = await prisma.kPITypes.findFirst({
        where: { KPIName: { equals: item.kpiName, mode: 'insensitive' }, ParentKPIID: subThemeType.Id },
      });

      if (!kpiType) {
        kpiType = await prisma.kPITypes.create({
          data: { KPIName: item.kpiName, ParentKPIID: subThemeType.Id, CreatedAt: now() },
        });
      }

      // 5. Upsert KPI Master Record
      let kpi = await prisma.kPIs.findFirst({
        where: { KPITypeId: kpiType.Id, UnitId: unit.Id },
      });

      if (!kpi) {
        kpi = await prisma.kPIs.create({
          data: {
            KPITypeId: kpiType.Id,
            UnitId: unit.Id,
            Weight: item.weight,
            DefaultBaseline: item.baseline,
            Description: item.description,
            IsEvedenceRequired: item.isEvidenceRequired,
            LifecycleType: 'RECURRING',
            IsActive: true,
            CreatedAt: now(),
            CreatedBy: creatorId,
          },
        });
      } else {
        kpi = await prisma.kPIs.update({
          where: { Id: kpi.Id },
          data: {
            Weight: item.weight,
            DefaultBaseline: item.baseline,
            Description: item.description,
            IsEvedenceRequired: item.isEvidenceRequired,
          },
        });
      }

      // 6. Upsert KPI Year Plan
      let plan = await prisma.kPIYearPlans.findFirst({
        where: { KPIId: kpi.Id, CycleYear: cycleYear },
      });

      if (!plan) {
        await prisma.kPIYearPlans.create({
          data: {
            KPIId: kpi.Id,
            CycleYear: cycleYear,
            Baseline: item.baseline,
            Target: item.target,
            Status: 'ACTIVE',
            IsLocked: false,
            CreatedAt: now(),
          },
        });
      } else {
        await prisma.kPIYearPlans.update({
          where: { Id: plan.Id },
          data: {
            Baseline: item.baseline,
            Target: item.target,
          },
        });
      }

      seededCount++;
      console.log(`✔ [${seededCount}/10] KPI: "${item.kpiName}" (Target: ${item.target}, Weight: ${item.weight}%)`);
    }

    console.log('\n========================================');
    console.log(`🎉 SUCCESSFULLY SEEDED ${seededCount} KPIs!`);
    console.log('========================================\n');
  } catch (error) {
    console.error('❌ Failed to seed KPIs:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

seedKpis();
