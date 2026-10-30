import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  SETTINGS_REGISTRY,
  coerceSettingValue,
  deserializeSettingValue,
  getSettingDefinition,
  serializeSettingValue,
} from '../../config/settings.js';
import { auditAction } from '../../utils/auditLogger.js';
import { badRequest, forbidden, notFound } from '../../utils/httpError.js';
import { parseDate } from '../../utils/validation.js';

/**
 * Module 10 — System settings (registry in config/settings.json) and the audit trail.
 */

const fullName = (person) => (person ? [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') : null);
const PERSON_NAME_SELECT = { id: true, firstName: true, middleName: true, lastName: true };

const assertGlobal = (actor, code, what) => {
  if (!actor.access.canGlobally(code)) throw forbidden(`${what} requires university-wide ${code} authority`);
};

// ===== Settings cache =====
// All settings rows are small; keep them in memory. Updates through this module clear the cache immediately;
// the TTL bounds staleness if another process (e.g. a second server instance) changes them.
const CACHE_TTL_MS = 30 * 1000;
let cache = null;

const loadRows = async () => {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rows;
  const rows = await prisma.systemSetting.findMany({
    include: { updatedBy: { select: PERSON_NAME_SELECT } },
  });
  cache = { loadedAt: Date.now(), rows: new Map(rows.map((row) => [`${row.groupName}.${row.key}`, row])) };
  return cache.rows;
};

const invalidateCache = () => {
  cache = null;
};

// Settings live only in the database (rows created by scripts/seedSettings.js, which also runs on server start).
const currentValue = (definition, row) => {
  if (!row) throw new Error(`Setting ${definition.group}.${definition.key} is missing from the database (run npm run seed:settings)`);
  return deserializeSettingValue(definition, row);
};

const defaultValueOf = (definition) => definition.default ?? null;
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Typed value of one setting, read from the database. For use by any module, e.g.
 * `await getSetting('kpi', 'rating_bands')`.
 */
export const getSetting = async (group, key) => {
  const definition = getSettingDefinition(group, key);
  if (!definition) throw new Error(`Unknown setting ${group}.${key} (not in config/settings.json)`);
  const rows = await loadRows();
  return currentValue(definition, rows.get(`${group}.${key}`));
};

/**
 * All typed values of a group as { key: value }.
 */
export const getSettingsGroup = async (group) => {
  const groupDefinition = SETTINGS_REGISTRY.get(group);
  if (!groupDefinition) throw new Error(`Unknown settings group "${group}"`);
  const rows = await loadRows();
  return Object.fromEntries(
    [...groupDefinition.settings.values()].map((definition) => [definition.key, currentValue(definition, rows.get(`${group}.${definition.key}`))])
  );
};

const describeSetting = (definition, row) => ({
  key: definition.key,
  label: definition.label,
  description: definition.description,
  type: definition.type,
  ...(definition.options && { options: definition.options }),
  ...(definition.min !== undefined && { min: definition.min }),
  ...(definition.max !== undefined && { max: definition.max }),
  ...(definition.maxLength !== undefined && { maxLength: definition.maxLength }),
  isPublic: definition.public,
  value: currentValue(definition, row),
  defaultValue: defaultValueOf(definition),
  isDefault: sameValue(currentValue(definition, row), defaultValueOf(definition)),
  updatedAt: row?.updatedAt ?? null,
  updatedBy: row?.updatedBy ? { id: row.updatedBy.id, fullName: fullName(row.updatedBy) } : null,
});

const describeGroup = (groupDefinition, rows) => ({
  group: groupDefinition.group,
  label: groupDefinition.label,
  description: groupDefinition.description,
  settings: [...groupDefinition.settings.values()].map((definition) =>
    describeSetting(definition, rows.get(`${groupDefinition.group}.${definition.key}`))
  ),
});

// ===== Settings endpoints =====

/**
 * Public configuration (no login): every `public` setting as { group: { key: value } },
 * plus the active fiscal year. File settings return the File id.
 */
export const getPublicSettings = async () => {
  const rows = await loadRows();
  const settings = {};
  for (const groupDefinition of SETTINGS_REGISTRY.values()) {
    const publicDefinitions = [...groupDefinition.settings.values()].filter((definition) => definition.public);
    if (publicDefinitions.length === 0) continue;
    settings[groupDefinition.group] = Object.fromEntries(
      publicDefinitions.map((definition) => [definition.key, currentValue(definition, rows.get(`${groupDefinition.group}.${definition.key}`))])
    );
  }

  const activeFiscalYear = await prisma.fiscalYear.findFirst({ where: { status: 'active' }, select: { id: true, label: true } });
  return { ...settings, activeFiscalYear };
};

export const getSettingsGrouped = async (actor) => {
  assertGlobal(actor, PERMISSIONS.SETTINGS_MANAGE, 'Viewing system settings');
  const rows = await loadRows();
  return [...SETTINGS_REGISTRY.values()].map((groupDefinition) => describeGroup(groupDefinition, rows));
};

/**
 * Batch update one group: { settings: [{ key, value }] }. value null writes the registry default.
 * All entries are validated first; nothing is saved if any is invalid. Only changed keys are audited.
 */
export const updateSettingsGroup = async (groupName, { settings } = {}, actor) => {
  assertGlobal(actor, PERMISSIONS.SETTINGS_MANAGE, 'Changing system settings');
  const groupDefinition = SETTINGS_REGISTRY.get(groupName);
  if (!groupDefinition) throw notFound(`Unknown settings group "${groupName}"`);
  if (!Array.isArray(settings) || settings.length === 0) throw badRequest('settings must be a non-empty array of { key, value }');

  const errors = [];
  const seen = new Set();
  const updates = [];
  for (const entry of settings) {
    const definition = groupDefinition.settings.get(entry?.key);
    if (!definition) {
      errors.push(`Unknown setting "${entry?.key}" in group "${groupName}"`);
      continue;
    }
    if (seen.has(entry.key)) {
      errors.push(`${entry.key} is listed more than once`);
      continue;
    }
    seen.add(entry.key);
    if (!('value' in entry)) {
      errors.push(`${entry.key} needs a value (null resets it to the default)`);
      continue;
    }
    const result = coerceSettingValue(definition, entry.value);
    if (result.error) errors.push(result.error);
    else updates.push({ definition, value: result.value });
  }

  // File settings must point at an existing File
  for (const { definition, value } of updates) {
    if (definition.type === 'file' && value && !(await prisma.file.findUnique({ where: { id: value }, select: { id: true } }))) {
      errors.push(`${definition.key} references a file that does not exist`);
    }
  }
  if (errors.length > 0) throw badRequest('Some settings are invalid', { errors });

  const rows = await loadRows();
  const oldValues = {};
  const newValues = {};
  const operations = [];
  for (const { definition, value } of updates) {
    const row = rows.get(`${groupName}.${definition.key}`);
    const before = currentValue(definition, row);
    const after = value === null ? defaultValueOf(definition) : value;
    if (sameValue(before, after)) continue;

    oldValues[definition.key] = before;
    newValues[definition.key] = after;
    operations.push(
      prisma.systemSetting.update({
        where: { id: row.id },
        data: {
          value: serializeSettingValue(definition, after),
          fileId: definition.type === 'file' ? after : null,
          updatedByPersonId: actor.personId,
        },
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
    invalidateCache();
    await auditAction(actor, { action: 'SETTINGS_UPDATED', entityType: 'system_setting', entityId: groupName, oldValues, newValues });
  }

  return { ...describeGroup(groupDefinition, await loadRows()), changedKeys: Object.keys(newValues) };
};

// ===== Audit trail =====

/**
 * Field-level differences between oldValues and newValues (top-level keys).
 */
const diffValues = (oldValues, newValues) => {
  const before = oldValues && typeof oldValues === 'object' ? oldValues : {};
  const after = newValues && typeof newValues === 'object' ? newValues : {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, old: before[field] ?? null, new: after[field] ?? null }));
};

const formatActor = (actor) => (actor ? { id: actor.id, fullName: fullName(actor) } : null);

/**
 * Paginated audit trail, newest first. `to` includes the whole day.
 */
export const listAuditLogs = async ({ actorPersonId, action, entityType, entityId, from, to, page = 1, limit = 20 } = {}, actor) => {
  assertGlobal(actor, PERMISSIONS.AUDIT_READ, 'Reading the audit trail');

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const fromDate = parseDate(from, 'from', { required: false });
  const toDate = parseDate(to, 'to', { required: false });
  if (fromDate && toDate && toDate < fromDate) throw badRequest('to must be on or after from');

  const where = {
    ...(actorPersonId && { actorPersonId }),
    ...(action && { action: String(action).trim().toUpperCase() }),
    ...(entityType && { entityType: String(entityType).trim() }),
    ...(entityId && { entityId: String(entityId).trim() }),
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lt: new Date(toDate.getTime() + 24 * 60 * 60 * 1000) }),
      },
    }),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { actor: { select: PERSON_NAME_SELECT } },
    }),
  ]);

  return {
    data: logs.map(({ oldValues, newValues, actor: person, actorPersonId: _id, userAgent: _ua, ...log }) => ({
      ...log,
      actor: formatActor(person),
      changedFields: diffValues(oldValues, newValues).map((change) => change.field),
    })),
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  };
};

export const getAuditLogById = async (id, actor) => {
  assertGlobal(actor, PERMISSIONS.AUDIT_READ, 'Reading the audit trail');
  const log = await prisma.auditLog.findUnique({ where: { id }, include: { actor: { select: PERSON_NAME_SELECT } } });
  if (!log) throw notFound('Audit log entry not found');

  const { actor: person, actorPersonId: _id, ...rest } = log;
  return { ...rest, actor: formatActor(person), changes: diffValues(log.oldValues, log.newValues) };
};

/**
 * Values for audit filter dropdowns: distinct actions, entity types and actors.
 */
export const getAuditFilters = async (actor) => {
  assertGlobal(actor, PERMISSIONS.AUDIT_READ, 'Reading the audit trail');
  const [actions, entityTypes, actorRows] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    prisma.auditLog.findMany({ distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' } }),
    prisma.auditLog.findMany({
      where: { actorPersonId: { not: null } },
      distinct: ['actorPersonId'],
      select: { actor: { select: PERSON_NAME_SELECT } },
    }),
  ]);

  return {
    actions: actions.map((row) => row.action),
    entityTypes: entityTypes.map((row) => row.entityType),
    actors: actorRows
      .map((row) => formatActor(row.actor))
      .filter(Boolean)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  };
};

export default {
  getSetting,
  getSettingsGroup,
  getPublicSettings,
  getSettingsGrouped,
  updateSettingsGroup,
  listAuditLogs,
  getAuditLogById,
  getAuditFilters,
};
