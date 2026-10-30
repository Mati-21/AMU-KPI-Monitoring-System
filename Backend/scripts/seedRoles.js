import 'dotenv/config';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import { PERMISSION_CATALOG, SUPER_ADMIN_ROLE } from '../config/permissions.js';

/**
 * Seed the baseline roles from config/roles.json.
 *  - missing roles are created with their permission set;
 *  - existing roles are left as they are (they may have been edited through the API),
 *    unless run with --sync, which resets their description and permission set to the JSON.
 * Safe to run repeatedly. Run `npm run seed:permissions` first so every permission code exists.
 */
const { roles } = JSON.parse(readFileSync(new URL('../config/roles.json', import.meta.url), 'utf8'));
const SYNC = process.argv.includes('--sync');

const codesByResource = PERMISSION_CATALOG.entries.reduce((map, entry) => {
  map.set(entry.resource, [...(map.get(entry.resource) || []), entry.code]);
  return map;
}, new Map());
const knownCodes = new Set(PERMISSION_CATALOG.entries.map((entry) => entry.code));

/**
 * Expand "resource:*" and validate every code against config/permissions.json.
 */
const expandCodes = (role) => {
  const codes = role.permissions.flatMap((code) => {
    const [resource, action] = code.split(':');
    if (action === '*') {
      if (!codesByResource.has(resource)) throw new Error(`roles.json: "${role.name}" uses unknown resource "${resource}:*"`);
      return codesByResource.get(resource);
    }
    if (!knownCodes.has(code)) throw new Error(`roles.json: "${role.name}" uses unknown permission "${code}"`);
    return [code];
  });
  return [...new Set(codes)].sort();
};

export const seedRoles = async () => {
  console.log(`🛡️  Seeding ${roles.length} baseline roles from config/roles.json${SYNC ? ' (--sync: existing roles reset)' : ''}...`);

  const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionIds = new Map(permissions.map((p) => [p.code, p.id]));

  const summary = { created: 0, synced: 0, unchanged: 0 };
  for (const definition of roles) {
    if (definition.name === SUPER_ADMIN_ROLE) throw new Error(`roles.json must not define "${SUPER_ADMIN_ROLE}" (managed by seed:admin)`);

    const codes = expandCodes(definition);
    const missing = codes.filter((code) => !permissionIds.has(code));
    if (missing.length > 0) throw new Error(`Permission codes missing in the database: ${missing.join(', ')}. Run npm run seed:permissions first.`);
    const links = codes.map((code) => ({ permissionId: permissionIds.get(code) }));

    const existing = await prisma.role.findFirst({ where: { name: { equals: definition.name, mode: 'insensitive' } } });
    let status;
    if (!existing) {
      await prisma.role.create({ data: { name: definition.name, description: definition.description, permissions: { create: links } } });
      summary.created += 1;
      status = 'created';
    } else if (SYNC) {
      await prisma.$transaction([
        prisma.role.update({ where: { id: existing.id }, data: { description: definition.description } }),
        prisma.rolePermission.deleteMany({ where: { roleId: existing.id } }),
        prisma.rolePermission.createMany({ data: links.map((link) => ({ roleId: existing.id, ...link })) }),
      ]);
      summary.synced += 1;
      status = 'synced';
    } else {
      summary.unchanged += 1;
      status = 'exists (unchanged)';
    }
    console.log(`   ${definition.name.padEnd(24)} ${String(codes.length).padStart(2)} permissions  ${status}`);
  }

  console.log(`✅ Roles: ${summary.created} created, ${summary.synced} synced, ${summary.unchanged} unchanged`);
  return summary;
};

// Run directly (npm run seed:roles), but not when imported.
// Compare case-insensitively on Windows, where the drive letter case can differ (c:\ vs C:\).
const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedRoles()
    .catch((error) => {
      console.error('❌ Role seeding failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedRoles;
