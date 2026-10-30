import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import { SETTINGS_REGISTRY, serializeSettingValue } from '../config/settings.js';

/**
 * Sync the `system_setting` table with config/settings.json:
 *  - creates missing settings with their registry default,
 *  - keeps values already saved (admin changes are never overwritten),
 *  - refreshes type, description and visibility when the registry changes them
 *    (a setting whose type changed is reset to its new default),
 *  - removes settings that are no longer in the registry.
 * Safe to run repeatedly; also runs on every server start.
 */
const metadataOf = (definition) => ({
  valueType: definition.type,
  description: definition.description ?? null,
  isPublic: definition.public,
});

const defaultValueOf = (definition) => {
  const value = definition.default ?? null;
  return {
    value: serializeSettingValue(definition, value),
    fileId: definition.type === 'file' ? value : null,
  };
};

export const seedSettings = async ({ quiet = false } = {}) => {
  const log = quiet ? () => {} : console.log;
  const definitions = [...SETTINGS_REGISTRY.values()].flatMap((group) => [...group.settings.values()]);
  log(`⚙️  Syncing ${definitions.length} settings from config/settings.json...`);

  const rows = await prisma.systemSetting.findMany({
    select: { id: true, groupName: true, key: true, valueType: true, description: true, isPublic: true },
  });
  const rowsByKey = new Map(rows.map((row) => [`${row.groupName}.${row.key}`, row]));

  const missing = definitions.filter((definition) => !rowsByKey.has(`${definition.group}.${definition.key}`));
  if (missing.length > 0) {
    await prisma.systemSetting.createMany({
      data: missing.map((definition) => ({
        groupName: definition.group,
        key: definition.key,
        ...metadataOf(definition),
        ...defaultValueOf(definition),
      })),
      skipDuplicates: true,
    });
  }

  // Only touch rows whose metadata differs, so updated_at keeps meaning "last changed".
  const updates = [];
  let retyped = 0;
  for (const definition of definitions) {
    const row = rowsByKey.get(`${definition.group}.${definition.key}`);
    if (!row) continue;
    const metadata = metadataOf(definition);
    const typeChanged = row.valueType !== metadata.valueType;
    if (!typeChanged && row.description === metadata.description && row.isPublic === metadata.isPublic) continue;
    if (typeChanged) retyped += 1;
    updates.push(
      prisma.systemSetting.update({
        where: { id: row.id },
        data: { ...metadata, ...(typeChanged && { ...defaultValueOf(definition), updatedByPersonId: null }) },
      })
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);

  const declared = new Set(definitions.map((definition) => `${definition.group}.${definition.key}`));
  const staleIds = rows.filter((row) => !declared.has(`${row.groupName}.${row.key}`)).map((row) => row.id);
  if (staleIds.length > 0) await prisma.systemSetting.deleteMany({ where: { id: { in: staleIds } } });

  log(
    `✅ Settings synced: ${missing.length} added, ${updates.length} updated` +
      (retyped > 0 ? ` (${retyped} reset to default after a type change)` : '') +
      `, ${staleIds.length} removed`
  );
  return { added: missing.length, updated: updates.length, retyped, removed: staleIds.length };
};

// Run directly (npm run seed:settings), but not when imported by seedAdmin.js or server.js.
// Compare case-insensitively on Windows, where the drive letter case can differ (c:\ vs C:\).
const normalizePath = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
if (process.argv[1] && normalizePath(fileURLToPath(import.meta.url)) === normalizePath(process.argv[1])) {
  seedSettings()
    .catch((error) => {
      console.error('❌ Settings seeding failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

export default seedSettings;
