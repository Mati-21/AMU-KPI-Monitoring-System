import { readFileSync } from 'fs';

/**
 * Permission catalog, loaded from config/permissions.json (the single source of truth).
 * Route guards use PERMISSIONS.<RESOURCE>_<ACTION>; scripts/seedAdmin.js syncs PERMISSION_CODES into the database.
 */
const catalog = JSON.parse(readFileSync(new URL('./permissions.json', import.meta.url), 'utf8'));

const CODE_PART = /^[a-z][a-z_]*$/;

/**
 * Flatten modules -> resources -> permissions into one list, validating names and uniqueness at startup.
 */
const buildEntries = () => {
  const seen = new Set();
  return catalog.modules.flatMap((module) =>
    module.resources.flatMap(({ resource, label, permissions }) =>
      permissions.map(({ action, description }) => {
        if (!CODE_PART.test(resource) || !CODE_PART.test(action)) {
          throw new Error(`config/permissions.json: invalid permission "${resource}:${action}" (use lower-case letters and _)`);
        }
        const code = `${resource}:${action}`;
        if (seen.has(code)) throw new Error(`config/permissions.json: duplicate permission "${code}"`);
        seen.add(code);
        return { code, key: `${resource}_${action}`.toUpperCase(), resource, action, description, label, module: module.module, moduleName: module.name };
      })
    )
  );
};

const ENTRIES = buildEntries();

export const SUPER_ADMIN_PERMISSION = catalog.superAdmin.code;

/** Name of the built-in role that holds the wildcard; protected from rename, deletion and losing '*'. */
export const SUPER_ADMIN_ROLE = 'Super Admin';

/** e.g. PERMISSIONS.OFFICE_CREATE === 'office:create' */
export const PERMISSIONS = Object.freeze(Object.fromEntries(ENTRIES.map((entry) => [entry.key, entry.code])));

export const PERMISSION_CODES = Object.freeze([SUPER_ADMIN_PERMISSION, ...ENTRIES.map((entry) => entry.code)]);

/** Full catalog with descriptions, grouped as in the JSON (for GET /permissions and documentation). */
export const PERMISSION_CATALOG = Object.freeze({
  superAdmin: catalog.superAdmin,
  modules: catalog.modules,
  entries: ENTRIES,
});

export default { SUPER_ADMIN_PERMISSION, SUPER_ADMIN_ROLE, PERMISSIONS, PERMISSION_CODES, PERMISSION_CATALOG };
