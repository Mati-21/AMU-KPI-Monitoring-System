import { readFileSync } from 'fs';

/**
 * Settings registry, loaded from config/settings.json (single source of truth for which settings exist,
 * their types, defaults and visibility). Values are stored as text in `system_setting.value`
 * (file settings use `file_id`) and converted with the helpers below.
 */
const registry = JSON.parse(readFileSync(new URL('./settings.json', import.meta.url), 'utf8'));

const TYPES = new Set(['text', 'email', 'number', 'boolean', 'enum', 'json', 'file', 'datetime']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validators for json settings. Each returns an error message, or null when valid.
 */
const JSON_VALIDATORS = {
  stringList: (value) =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim())
      ? null
      : 'must be a non-empty list of names',
  dayList: (value) =>
    Array.isArray(value) && value.every((day) => Number.isInteger(day) && day >= 1 && day <= 90) && new Set(value).size === value.length
      ? null
      : 'must be a list of distinct whole days between 1 and 90',
  ratingBands: (value) => {
    if (!Array.isArray(value) || value.length === 0) return 'must be a non-empty list of { min, label }';
    for (const band of value) {
      if (typeof band?.label !== 'string' || !band.label.trim()) return 'each band needs a label';
      if (typeof band?.min !== 'number' || band.min < 0 || band.min > 200) return 'each band needs a min between 0 and 200';
    }
    for (let i = 1; i < value.length; i += 1) {
      if (value[i].min >= value[i - 1].min) return 'bands must be ordered from highest min to lowest';
    }
    return value[value.length - 1].min === 0 ? null : 'the last band must start at 0';
  },
};

/**
 * Validate and normalize an input value for a setting definition.
 * Returns { value } on success or { error } with a human-readable message. null is always allowed (= write the default).
 */
export const coerceSettingValue = (definition, input) => {
  if (input === null) return { value: null };
  const fail = (message) => ({ error: `${definition.key} ${message}` });

  switch (definition.type) {
    case 'text': {
      if (typeof input !== 'string') return fail('must be text');
      const text = input.trim();
      if (!text) return fail('cannot be empty (send null to reset to default)');
      if (definition.maxLength && text.length > definition.maxLength) return fail(`must be at most ${definition.maxLength} characters`);
      return { value: text };
    }
    case 'email': {
      if (typeof input !== 'string' || !EMAIL.test(input.trim())) return fail('must be a valid email address');
      return { value: input.trim().toLowerCase() };
    }
    case 'number': {
      if (typeof input !== 'number' || !Number.isFinite(input)) return fail('must be a number');
      if (definition.integer && !Number.isInteger(input)) return fail('must be a whole number');
      if (definition.min !== undefined && input < definition.min) return fail(`must be at least ${definition.min}`);
      if (definition.max !== undefined && input > definition.max) return fail(`must be at most ${definition.max}`);
      return { value: input };
    }
    case 'boolean':
      return typeof input === 'boolean' ? { value: input } : fail('must be true or false');
    case 'enum':
      return definition.options.includes(input) ? { value: input } : fail(`must be one of: ${definition.options.join(', ')}`);
    case 'json': {
      const message = JSON_VALIDATORS[definition.validator](input);
      return message ? fail(message) : { value: input };
    }
    case 'file':
      return typeof input === 'string' && UUID.test(input) ? { value: input } : fail('must be a File id (uuid)');
    case 'datetime': {
      const date = typeof input === 'string' ? new Date(input) : null;
      return date && !Number.isNaN(date.getTime()) ? { value: date.toISOString() } : fail('must be an ISO date-time');
    }
    default:
      return fail('has an unsupported type');
  }
};

/**
 * Convert a normalized value to the stored text (file settings are stored in file_id instead).
 */
export const serializeSettingValue = (definition, value) => {
  if (value === null || definition.type === 'file') return null;
  if (definition.type === 'json') return JSON.stringify(value);
  return String(value);
};

/**
 * Convert a stored row back to a typed value.
 */
export const deserializeSettingValue = (definition, row) => {
  if (definition.type === 'file') return row.fileId ?? null;
  if (row.value === null || row.value === undefined) return null;
  switch (definition.type) {
    case 'number':
      return Number(row.value);
    case 'boolean':
      return row.value === 'true';
    case 'json':
      try {
        return JSON.parse(row.value);
      } catch {
        throw new Error(`Setting ${definition.group}.${definition.key} holds invalid JSON in the database`);
      }
    default:
      return row.value;
  }
};

/**
 * Validate the registry at startup: unique groups/keys, known types, and defaults that pass their own validation.
 */
const buildRegistry = () => {
  const groups = new Map();
  for (const group of registry.groups) {
    if (groups.has(group.group)) throw new Error(`config/settings.json: duplicate group "${group.group}"`);
    const settings = new Map();
    for (const definition of group.settings) {
      const where = `config/settings.json: ${group.group}.${definition.key}`;
      if (settings.has(definition.key)) throw new Error(`${where} is declared twice`);
      if (!TYPES.has(definition.type)) throw new Error(`${where} has unknown type "${definition.type}"`);
      if (definition.type === 'enum' && !Array.isArray(definition.options)) throw new Error(`${where} needs options`);
      if (definition.type === 'json' && !JSON_VALIDATORS[definition.validator]) throw new Error(`${where} needs a known validator`);
      const check = coerceSettingValue(definition, definition.default ?? null);
      if (check.error) throw new Error(`${where} has an invalid default: ${check.error}`);
      settings.set(definition.key, { ...definition, group: group.group, public: Boolean(definition.public) });
    }
    groups.set(group.group, { group: group.group, label: group.label, description: group.description, settings });
  }
  return groups;
};

/** Map<groupName, { group, label, description, settings: Map<key, definition> }> */
export const SETTINGS_REGISTRY = buildRegistry();

export const getSettingDefinition = (group, key) => SETTINGS_REGISTRY.get(group)?.settings.get(key) ?? null;

export default { SETTINGS_REGISTRY, getSettingDefinition, coerceSettingValue, serializeSettingValue, deserializeSettingValue };
