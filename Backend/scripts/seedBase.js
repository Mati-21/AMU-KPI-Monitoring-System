import 'dotenv/config';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

import { prisma } from '../config/database.js';
import { SUPER_ADMIN_ROLE } from '../config/permissions.js';
import { getActiveGrants, hasGlobalPermission, hasPermission, isSuperAdmin, reachesOffice } from '../modules/03-access-control/access.service.js';
import { createTheme, setScaleScoring } from '../modules/04-kpi-catalog/catalog.service.js';
import { createKpi } from '../modules/04-kpi-catalog/kpi.service.js';
import { startOfTodayUtc } from '../utils/dates.js';
import { seedPermissions } from './seedPermissions.js';
import { seedReference } from './seedReference.js';
import { seedScalesUnits } from './seedScalesUnits.js';
import { seedSettings } from './seedSettings.js';
import { newStaffNumber } from '../utils/staffNumber.js';

/**
 * npm run seed:base — everything the system needs before anyone plans a year, without touching what is there:
 *   settings and permissions, currencies, measurement units, reporting frequencies, performance bands, document types,
 *   stage and rating scales (their scoring approved), the KPI themes, and 30 KPIs covering every measurement type
 *   (number, money in birr, percentage, ratio, stage, category), both directions and every reporting frequency.
 * Only what is missing is added, so it is safe to run again. On an empty database it also creates the Super Admin,
 * who has to change the password at the first sign-in.
 */

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Amu@12345';

// ===== The catalog =====

export const THEMES = [
  { name: 'Academic Excellence', subs: ['Teaching and Learning', 'Student Success'] },
  { name: 'Research and Innovation', subs: ['Research Output', 'Research Funding'] },
  { name: 'Community Engagement', subs: ['Outreach and Services'] },
  { name: 'Institutional Capacity', subs: ['Finance', 'ICT and Digital', 'Human Resources'] },
];

// parts: the two numbers a percentage or ratio is worked out from. rollup: how the periods of a year add up, when it
// is not a plain sum. single: a figure that cannot be added between offices, so only one office reports it.
export const KPIS = [
  { name: 'Graduation rate', type: 'PERCENTAGE', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Student Success', parts: ['Graduates', 'Final-year students'] },
  { name: 'Student enrolment', type: 'NUMBER', unit: 'Student', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'Student Success', rollup: 'LATEST' },
  { name: 'Student dropout rate', type: 'PERCENTAGE', dir: 'LOWER_IS_BETTER', freq: 'Semi-annual', sub: 'Student Success', parts: ['Students who left', 'Students enrolled'] },
  { name: 'Student to teacher ratio', type: 'RATIO', dir: 'LOWER_IS_BETTER', freq: 'Annual', sub: 'Teaching and Learning', parts: ['Students', 'Teachers'] },
  { name: 'Courses with an updated curriculum', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Teaching and Learning' },
  { name: 'Programme accreditation progress', type: 'STAGE', scale: 'Accreditation Progress', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Teaching and Learning' },
  { name: 'Teaching quality rating', type: 'CATEGORY', scale: 'Five-Point Rating', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'Teaching and Learning' },
  { name: 'Laboratory hours delivered', type: 'NUMBER', unit: 'Hour', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Teaching and Learning' },
  { name: 'Student complaints received', type: 'NUMBER', unit: 'Count', dir: 'LOWER_IS_BETTER', freq: 'Quarterly', sub: 'Student Success' },
  { name: 'Exit exam pass rate', type: 'PERCENTAGE', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Student Success', parts: ['Students who passed', 'Students who sat'] },
  { name: 'Courses offered through e-learning', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Teaching and Learning', rollup: 'LATEST' },
  { name: 'Students placed in internships', type: 'NUMBER', unit: 'Student', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'Student Success' },
  { name: 'Research publications', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Research Output' },
  { name: 'Research grant income', type: 'MONEY', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Research Funding' },
  { name: 'Patents filed', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Research Output' },
  { name: 'Research projects completed on time', type: 'PERCENTAGE', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'Research Output', parts: ['Projects on time', 'Projects due'] },
  { name: 'Industry partnerships signed', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'Research Funding' },
  { name: 'Flagship research project stage', type: 'STAGE', scale: 'Project Implementation Stages', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Research Output' },
  { name: 'Consultancy income', type: 'MONEY', dir: 'HIGHER_IS_BETTER', freq: 'Monthly', sub: 'Research Funding' },
  { name: 'Research ethics compliance', type: 'CATEGORY', scale: 'Compliance', dir: 'HIGHER_IS_BETTER', freq: 'Annual', sub: 'Research Output' },
  { name: 'Community service projects', type: 'NUMBER', unit: 'Count', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Outreach and Services' },
  { name: 'Community members trained', type: 'NUMBER', unit: 'Person', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Outreach and Services' },
  { name: 'Income from services', type: 'MONEY', dir: 'HIGHER_IS_BETTER', freq: 'Monthly', sub: 'Outreach and Services' },
  { name: 'Budget utilization rate', type: 'PERCENTAGE', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Finance', parts: ['Budget used', 'Budget allocated'] },
  { name: 'Average procurement processing days', type: 'NUMBER', unit: 'Day', dir: 'LOWER_IS_BETTER', freq: 'Quarterly', sub: 'Finance', rollup: 'AVERAGE', single: true },
  { name: 'Audit findings', type: 'NUMBER', unit: 'Count', dir: 'LOWER_IS_BETTER', freq: 'Annual', sub: 'Finance' },
  { name: 'Digital service maturity', type: 'STAGE', scale: 'Digital Service Maturity', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'ICT and Digital' },
  { name: 'Staff trained', type: 'NUMBER', unit: 'Person', dir: 'HIGHER_IS_BETTER', freq: 'Quarterly', sub: 'Human Resources' },
  { name: 'Staff turnover rate', type: 'PERCENTAGE', dir: 'LOWER_IS_BETTER', freq: 'Annual', sub: 'Human Resources', parts: ['Staff who left', 'Total staff'] },
  { name: 'Customer satisfaction', type: 'CATEGORY', scale: 'Five-Point Rating', dir: 'HIGHER_IS_BETTER', freq: 'Semi-annual', sub: 'ICT and Digital' },
];

// ===== Helpers =====

/**
 * The actor object the services expect, built from a person's real grants.
 */
export const actorFor = async (person, userAgent = 'seed') => {
  const grants = await getActiveGrants(person.id);
  return {
    personId: person.id,
    accountId: person.accountId,
    access: {
      grants,
      isSuperAdmin: isSuperAdmin(grants),
      can: (code, officeId) => hasPermission(grants, code, officeId),
      canGlobally: (code) => hasGlobalPermission(grants, code),
      reaches: (code, scopeOfficeId) => reachesOffice(grants, code, scopeOfficeId),
    },
    ipAddress: null,
    userAgent,
  };
};

/**
 * The first Super Admin, on an empty database: placed in a root office so the role has somewhere to apply.
 */
const ensureSuperAdmin = async () => {
  const role = (await prisma.role.findUnique({ where: { name: SUPER_ADMIN_ROLE } })) ?? (await prisma.role.create({ data: { name: SUPER_ADMIN_ROLE, description: 'Full institutional authority', isSystem: true } }));
  await seedPermissions({ quiet: true });

  const holder = await prisma.officePersonRole.findFirst({ where: { roleId: role.id }, select: { officePerson: { select: { person: { select: { id: true, userAccount: { select: { id: true } } } } } } } });
  if (holder) return { person: { id: holder.officePerson.person.id, accountId: holder.officePerson.person.userAccount?.id ?? null }, created: false };

  const today = startOfTodayUtc();
  const type = (await prisma.officeType.findUnique({ where: { name: 'University' } })) ?? (await prisma.officeType.create({ data: { name: 'University', levelOrder: 1 } }));
  const office = (await prisma.office.findFirst({ where: { parentOfficeId: null } })) ?? (await prisma.office.create({ data: { name: 'Arba Minch University', code: 'AMU', officeTypeId: type.id } }));
  const position = await prisma.position.create({ data: { officeId: office.id, title: 'System Administrator' } });
  const person = await prisma.person.create({ data: { staffNumber: await newStaffNumber(), firstName: 'System', lastName: 'Administrator', email: `${ADMIN_USERNAME}@amu.edu.et` } });
  const account = await prisma.userAccount.create({
    data: { personId: person.id, username: ADMIN_USERNAME, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), isActive: true, mustChangePassword: true, mfaEnforced: false, mfaEnabled: false, mfaType: 'totp' },
  });
  const placement = await prisma.officePerson.create({ data: { personId: person.id, officeId: office.id, positionId: position.id, startDate: today, isPrimary: true } });
  await prisma.officePersonRole.create({ data: { officePersonId: placement.id, roleId: role.id, validFrom: today } });
  return { person: { id: person.id, accountId: account.id }, created: true };
};

// Stage and rating scales count towards scores once their scoring is approved
const approveScaleScoring = async (actor) => {
  for (const scale of await prisma.kpiScale.findMany({ where: { isOrdered: true, isBinary: false, scoringApproved: false } })) {
    await setScaleScoring(scale.id, { approved: true }, actor).catch((error) => console.log(`   Scale "${scale.name}" left unapproved: ${error.message}`));
  }
};

const seedThemes = async (actor) => {
  const subThemes = {};
  for (const [index, theme] of THEMES.entries()) {
    const parent = (await prisma.kpiTheme.findFirst({ where: { name: theme.name, parentThemeId: null } })) ?? (await createTheme({ name: theme.name, sortOrder: index + 1 }, actor));
    for (const [subIndex, sub] of theme.subs.entries()) {
      subThemes[sub] = (await prisma.kpiTheme.findFirst({ where: { name: sub, parentThemeId: parent.id } })) ?? (await createTheme({ name: sub, parentThemeId: parent.id, sortOrder: subIndex + 1 }, actor));
    }
  }
  return subThemes;
};

const kpiInput = (definition, { subThemes, units, scales, frequencies, currency }) => ({
  name: definition.name,
  description: `${definition.name} across the university`,
  themeId: subThemes[definition.sub].id,
  measurementType: definition.type,
  direction: definition.dir,
  defaultFrequencyId: frequencies.find((frequency) => frequency.name === definition.freq).id,
  ...(definition.unit && { unitId: units.find((unit) => unit.name === definition.unit).id }),
  ...(definition.type === 'MONEY' && { currencyId: currency.id }),
  ...(definition.scale && { scaleId: scales.find((scale) => scale.name === definition.scale).id }),
  ...(definition.parts && { numeratorLabel: definition.parts[0], denominatorLabel: definition.parts[1] }),
  ...(definition.rollup && { periodRollupMethod: definition.rollup }),
  ...(definition.single && { isAdditive: false, aggregationMethod: 'DIRECT' }),
});

/**
 * The 30 KPIs, each with its scale levels. Those already in the catalog are kept as they are.
 */
const seedKpis = async (actor, subThemes) => {
  const [units, scales, frequencies, currency] = await Promise.all([
    prisma.measurementUnit.findMany(),
    prisma.kpiScale.findMany({ include: { levels: { orderBy: { sortOrder: 'asc' } } } }),
    prisma.reportingFrequency.findMany(),
    prisma.currency.findFirst({ where: { code: 'ETB' } }),
  ]);
  const lookups = { subThemes, units, scales, frequencies, currency };
  const kpis = [];
  let added = 0;
  for (const definition of KPIS) {
    let kpi = await prisma.kpi.findFirst({ where: { name: definition.name } });
    if (!kpi) {
      kpi = await createKpi(kpiInput(definition, lookups), actor);
      added++;
    }
    kpis.push({ ...definition, id: kpi.id, levels: scales.find((scale) => scale.name === definition.scale)?.levels ?? [] });
  }
  return { kpis, added };
};

// ===== Run =====

/**
 * Seed the base. With an actor (the demo seed's Super Admin) the KPIs are recorded as theirs; without one the Super
 * Admin is found, or created on an empty database.
 */
export const seedBase = async ({ actor } = {}) => {
  await seedSettings({ quiet: true });
  await seedPermissions({ quiet: true });
  await seedReference();
  const { unitsAdded, scalesAdded } = await seedScalesUnits();
  console.log(`✅ Units and scales: ${unitsAdded.length} units and ${scalesAdded.length} scales added`);

  let admin = actor;
  let createdAdmin = false;
  if (!admin) {
    const { person, created } = await ensureSuperAdmin();
    admin = await actorFor(person, 'seed:base');
    createdAdmin = created;
  }
  await approveScaleScoring(admin);
  const subThemes = await seedThemes(admin);
  const { kpis, added } = await seedKpis(admin, subThemes);
  console.log(`📚 ${THEMES.length} themes with ${Object.keys(subThemes).length} sub-themes, and ${KPIS.length} KPIs (${added} added)`);
  if (createdAdmin) console.log(`🔐 Super Admin created: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD} (change it at the first sign-in)`);
  return { kpis, subThemes };
};

const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedBase()
    .catch((error) => {
      console.error('❌ Base seed failed:', error.message, error.details ?? '');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedBase;
