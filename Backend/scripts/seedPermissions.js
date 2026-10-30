import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import { PERMISSION_CATALOG, PERMISSION_CODES, SUPER_ADMIN_PERMISSION, SUPER_ADMIN_ROLE } from '../config/permissions.js';

/**
 * Sync the `permission` table with config/permissions.json:
 *  - creates missing codes,
 *  - removes codes that are no longer in the catalog (their role links cascade),
 *  - grants every code to the Super Admin role when that role exists.
 * Safe to run repeatedly; also runs on every server start.
 */
export const seedPermissions = async ({ quiet = false } = {}) => {
  const log = quiet ? () => {} : console.log;
  log(`🔑 Syncing ${PERMISSION_CODES.length} permission codes from config/permissions.json...`);
  for (const module of PERMISSION_CATALOG.modules) {
    const codes = module.resources.flatMap((r) => r.permissions.map((p) => `${r.resource}:${p.action}`));
    log(`   ${module.module} ${module.name.padEnd(28)} ${codes.join(', ')}`);
  }

  const existing = new Set((await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code));
  const missing = PERMISSION_CODES.filter((code) => !existing.has(code));
  if (missing.length > 0) {
    await prisma.permission.createMany({ data: missing.map((code) => ({ code })), skipDuplicates: true });
  }

  // Keep name, module and description in step with the catalog (only rows that differ)
  const rows = await prisma.permission.findMany();
  const metadata = new Map([
    [SUPER_ADMIN_PERMISSION, { name: 'All permissions', module: null, description: PERMISSION_CATALOG.superAdmin.description }],
    ...PERMISSION_CATALOG.entries.map((entry) => [entry.code, { name: `${entry.label}: ${entry.action}`, module: entry.moduleName, description: entry.description }]),
  ]);
  for (const row of rows) {
    const wanted = metadata.get(row.code);
    if (wanted && (row.name !== wanted.name || row.module !== wanted.module || row.description !== wanted.description)) {
      await prisma.permission.update({ where: { id: row.id }, data: wanted });
    }
  }

  const stale = await prisma.permission.deleteMany({ where: { code: { notIn: [...PERMISSION_CODES] } } });

  let grantedToSuperAdmin = 0;
  const superAdminRole = await prisma.role.findUnique({ where: { name: SUPER_ADMIN_ROLE } });
  if (superAdminRole) {
    const permissions = await prisma.permission.findMany({ select: { id: true } });
    const result = await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    grantedToSuperAdmin = result.count;
  }

  log(
    `✅ Permissions synced: ${missing.length} added, ${stale.count} removed, ` +
      (superAdminRole ? `${grantedToSuperAdmin} newly granted to ${SUPER_ADMIN_ROLE}` : `no "${SUPER_ADMIN_ROLE}" role yet (run npm run seed:admin)`)
  );
  return { added: missing.length, removed: stale.count, grantedToSuperAdmin };
};

// Run directly (npm run seed:permissions), but not when imported by seedAdmin.js or server.js.
// Compare case-insensitively on Windows, where the drive letter case can differ (c:\ vs C:\).
const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedPermissions()
    .catch((error) => {
      console.error('❌ Permission seeding failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedPermissions;
