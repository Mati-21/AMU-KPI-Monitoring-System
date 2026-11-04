import bcrypt from 'bcryptjs';

import { prisma } from '../../config/database.js';
import { SUPER_ADMIN_ROLE } from '../../config/permissions.js';
import { seedPermissions } from '../seedPermissions.js';

/**
 * The demo university: its offices, a head for each, three staff in each office at the bottom, and the Super Admin.
 *   President Office
 *   ├── Research Office ─ Public Office, Private Office
 *   └── Academic Office ─ AMiT ─ Civil Engineering, Electrical Engineering, Computing
 *                       └ AWiT ─ Metrology, Water Supply
 */

export const PASSWORD = 'Amu@12345';
// Everyone starts before the first demo year, so they are in place for all of it
const START = new Date('2025-09-01');

const OFFICE_TYPES = [
  { key: 'president', name: 'President Office', levelOrder: 1 },
  { key: 'vp', name: 'Vice President Office', levelOrder: 2 },
  { key: 'institute', name: 'Institute', levelOrder: 3 },
  { key: 'directorate', name: 'Directorate', levelOrder: 3 },
  { key: 'department', name: 'Department', levelOrder: 4 },
];

export const OFFICES = [
  { key: 'president', name: 'President Office', code: 'PRES', type: 'president', head: ['President', 'Damtew', 'Darza'] },
  { key: 'research', parent: 'president', name: 'Research Office', code: 'RES', type: 'vp', head: ['Vice President for Research', 'Tarekegn', 'Tadesse'] },
  { key: 'academic', parent: 'president', name: 'Academic Office', code: 'ACA', type: 'vp', head: ['Vice President for Academic Affairs', 'Simon', 'Shibru'] },
  { key: 'public', parent: 'research', name: 'Public Office', code: 'PUB', type: 'directorate', head: ['Director', 'Meseret', 'Alemu'] },
  { key: 'private', parent: 'research', name: 'Private Office', code: 'PRV', type: 'directorate', head: ['Director', 'Yonas', 'Bekele'] },
  { key: 'amit', parent: 'academic', name: 'AMiT', code: 'AMIT', type: 'institute', head: ['Scientific Director', 'Abebe', 'Kebede'] },
  { key: 'awit', parent: 'academic', name: 'AWiT', code: 'AWIT', type: 'institute', head: ['Scientific Director', 'Hirut', 'Mengistu'] },
  { key: 'civil', parent: 'amit', name: 'Civil Engineering', code: 'CIV', type: 'department', head: ['Department Head', 'Getachew', 'Ayele'] },
  { key: 'electrical', parent: 'amit', name: 'Electrical Engineering', code: 'ELE', type: 'department', head: ['Department Head', 'Selamawit', 'Girma'] },
  { key: 'computing', parent: 'amit', name: 'Computing', code: 'COMP', type: 'department', head: ['Department Head', 'Dawit', 'Haile'] },
  { key: 'metrology', parent: 'awit', name: 'Metrology', code: 'MET', type: 'department', head: ['Department Head', 'Tigist', 'Worku'] },
  { key: 'watersupply', parent: 'awit', name: 'Water Supply', code: 'WSE', type: 'department', head: ['Department Head', 'Henok', 'Desta'] },
];

const STAFF_NAMES = [
  ['Lidya', 'Tesfaye'], ['Samuel', 'Gebre'], ['Rahel', 'Mekonnen'], ['Natnael', 'Assefa'], ['Bethlehem', 'Taye'], ['Kaleb', 'Wolde'],
  ['Mahlet', 'Kassa'], ['Eyob', 'Tilahun'], ['Saron', 'Abate'], ['Biruk', 'Negash'], ['Hanna', 'Fikre'], ['Robel', 'Lemma'],
  ['Feven', 'Gizaw'], ['Yared', 'Asfaw'], ['Ruth', 'Teshome'], ['Nahom', 'Berhanu'], ['Eden', 'Mulugeta'], ['Abel', 'Tsegaye'],
  ['Kidist', 'Yirga'], ['Mikias', 'Demissie'], ['Selam', 'Haileselassie'],
];

// A head leads the office: signs its contract, passes KPIs down, gives staff contracts, reports and approves
const HEAD_PERMISSIONS = [
  'contract:read', 'contract:manage', 'contract:acknowledge', 'contract:request_change',
  'report:read', 'report:create', 'report:submit', 'report:review',
  'evidence:read', 'evidence:link', 'evidence:verify', 'document:create', 'file:read',
  // read_all within their own scope: the dashboards of the offices below them, to compare
  'scorecard:read', 'dashboard:read', 'dashboard:read_all',
];
// Staff see only their own staff contract and its dashboard, which need no contract, report or dashboard permission.
// They upload evidence for it.
const STAFF_PERMISSIONS = ['document:create', 'file:read'];

const createAccount = async ({ firstName, lastName, username, office, position, roleId, scoped = true }) => {
  const person = await prisma.person.create({ data: { firstName, lastName, email: `${username}@amu.edu.et` } });
  const account = await prisma.userAccount.create({
    data: { personId: person.id, username, passwordHash: await bcrypt.hash(PASSWORD, 10), isActive: true, mustChangePassword: false, mfaEnforced: false, mfaEnabled: false, mfaType: 'totp' },
  });
  const placement = await prisma.officePerson.create({ data: { personId: person.id, officeId: office.id, positionId: position.id, startDate: START, isPrimary: true } });
  // Scoped to their own office, so a head reaches the offices below it; the Super Admin has no scope
  await prisma.officePersonRole.create({ data: { officePersonId: placement.id, roleId, scopeOfficeId: scoped ? office.id : null, validFrom: START } });
  return { ...person, accountId: account.id, username, office };
};

export const buildOffices = async () => {
  const types = {};
  for (const type of OFFICE_TYPES) types[type.key] = await prisma.officeType.create({ data: { name: type.name, levelOrder: type.levelOrder } });

  const offices = {};
  for (const definition of OFFICES) {
    const isLeaf = !OFFICES.some((other) => other.parent === definition.key);
    const office = await prisma.office.create({
      data: { name: definition.name, code: definition.code, officeTypeId: types[definition.type].id, parentOfficeId: offices[definition.parent]?.id ?? null, canAssignKpi: !isLeaf },
    });
    await prisma.officeHierarchyHistory.create({ data: { officeId: office.id, parentOfficeId: office.parentOfficeId, validFrom: START, reason: 'Created by seed:demo' } });
    offices[definition.key] = { ...office, ...definition, isLeaf };
  }
  console.log(`🏛️  ${OFFICES.length} offices`);
  return offices;
};

/**
 * The Super Admin, a head for every office and three staff for every office at the bottom.
 */
export const buildPeople = async (offices) => {
  const permissionIds = async (codes) => (await prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true } })).map(({ id }) => ({ permissionId: id }));
  const superRole = await prisma.role.create({ data: { name: SUPER_ADMIN_ROLE, description: 'Full institutional authority', isSystem: true } });
  await seedPermissions({ quiet: true });
  const headRole = await prisma.role.create({ data: { name: 'Office Head', description: 'Leads an office: signs its contract, passes KPIs to the offices below, gives staff contracts, enters results and approves the offices below and its staff', permissions: { create: await permissionIds(HEAD_PERMISSIONS) } } });
  const staffRole = await prisma.role.create({ data: { name: 'Staff', description: 'Signs and reports on their own staff contract, under My Contract', permissions: { create: await permissionIds(STAFF_PERMISSIONS) } } });

  const people = { heads: {}, staff: [] };
  const top = offices.president;
  const adminPosition = await prisma.position.create({ data: { officeId: top.id, title: 'System Administrator' } });
  people.admin = await createAccount({ firstName: 'System', lastName: 'Administrator', username: 'admin', office: top, position: adminPosition, roleId: superRole.id, scoped: false });

  let staffIndex = 0;
  for (const office of Object.values(offices)) {
    const [title, firstName, lastName] = office.head;
    const headPosition = await prisma.position.create({ data: { officeId: office.id, title, isHead: true } });
    people.heads[office.key] = await createAccount({ firstName, lastName, username: `${office.key}.head`, office, position: headPosition, roleId: headRole.id });
    if (!office.isLeaf) continue;
    const staffPosition = await prisma.position.create({ data: { officeId: office.id, title: 'Staff' } });
    for (let n = 1; n <= 3; n++) {
      const [first, last] = STAFF_NAMES[staffIndex++];
      people.staff.push(await createAccount({ firstName: first, lastName: last, username: `${office.key}.staff${n}`, office, position: staffPosition, roleId: staffRole.id }));
    }
  }
  console.log(`👥 1 Super Admin, ${Object.keys(people.heads).length} heads and ${people.staff.length} staff`);
  return people;
};

export const printLogins = (people) => {
  console.log(`\n================ LOGINS (password for everyone: ${PASSWORD}) ================`);
  const rows = [['admin', 'Super Admin', 'President Office']];
  for (const office of OFFICES) {
    rows.push([people.heads[office.key].username, 'Head', office.name]);
    for (const staff of people.staff.filter((item) => item.office.key === office.key)) rows.push([staff.username, 'Staff', office.name]);
  }
  for (const [user, role, office] of rows) console.log(`${user.padEnd(22)} ${role.padEnd(12)} ${office}`);
  console.log('==========================================================================\n');
};
