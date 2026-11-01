import { prisma } from '../../config/database.js';
import { PERMISSION_CATALOG, PERMISSION_CODES, SUPER_ADMIN_PERMISSION } from '../../config/permissions.js';
import { activeOn } from '../../utils/dates.js';

/**
 * Scoped RBAC resolution.
 *
 * A person's authority comes from OfficePersonRole rows on their *active* office placements.
 * Each grant is { code, scopeOfficeId }: scopeOfficeId = null means university-wide,
 * otherwise the permission applies only to that office and its descendants.
 *
 * Reading is narrower. <resource>:read covers one office: the role's scope, or where the person is placed when the
 * role is university-wide. <resource>:read_all adds the offices below it, within the role's scope.
 */

// e.g. 'contract:read' -> 'contract:read_all'
const READ_ALL_OF = new Map(PERMISSION_CATALOG.entries.filter((entry) => entry.action === 'read_all').map((entry) => [`${entry.resource}:read`, entry.code]));
const READ_OF = new Map([...READ_ALL_OF].filter(([read]) => PERMISSION_CODES.includes(read)).map(([read, readAll]) => [readAll, read]));

/**
 * Load every currently-valid permission grant for a person.
 * @returns {Promise<Array<{ code: string, scopeOfficeId: string|null, roleId: number, roleName: string }>>}
 */
export const getActiveGrants = async (personId) => {
  const assignments = await prisma.officePersonRole.findMany({
    where: {
      ...activeOn('validFrom', 'validTo'),
      officePerson: { personId, ...activeOn('startDate', 'endDate') },
    },
    select: {
      scopeOfficeId: true,
      officePerson: { select: { officeId: true } },
      role: {
        select: {
          id: true,
          name: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  });

  return assignments.flatMap((assignment) =>
    assignment.role.permissions.flatMap(({ permission }) => {
      const grant = { code: permission.code, scopeOfficeId: assignment.scopeOfficeId, placedOfficeId: assignment.officePerson.officeId, roleId: assignment.role.id, roleName: assignment.role.name };
      // Whoever can read the offices below can read their own too
      return READ_OF.has(grant.code) ? [grant, { ...grant, code: READ_OF.get(grant.code) }] : [grant];
    })
  );
};

/**
 * IDs of the office and all of its ancestors up to the root (self first).
 */
export const getOfficeAncestorIds = async (officeId) => {
  const rows = await prisma.$queryRaw`
    WITH RECURSIVE chain AS (
      SELECT id, parent_office_id FROM office WHERE id = ${officeId}::uuid
      UNION ALL
      SELECT o.id, o.parent_office_id FROM office o JOIN chain c ON o.id = c.parent_office_id
    )
    SELECT id FROM chain`;
  return rows.map((row) => row.id);
};

export const isSuperAdmin = (grants) => grants.some((grant) => grant.code === SUPER_ADMIN_PERMISSION);

/**
 * The one office a read grant covers without read_all.
 */
export const ownOfficeOf = (grant) => grant.scopeOfficeId ?? grant.placedOfficeId;

const coversOffice = async (matching, targetOfficeId) => {
  if (matching.some((grant) => grant.scopeOfficeId === null)) return true;
  const ancestorIds = new Set(await getOfficeAncestorIds(targetOfficeId));
  return matching.some((grant) => ancestorIds.has(grant.scopeOfficeId));
};

const holding = (grants, code) => grants.filter((grant) => grant.code === code || grant.code === SUPER_ADMIN_PERMISSION);

/**
 * Check a permission against loaded grants.
 * Without targetOfficeId: true if the code is held in any scope (route-level gate).
 * With targetOfficeId: true only if a grant is global or scoped to that office or one of its ancestors.
 * A read code with a read_all partner follows the narrower reading rule above.
 */
export const hasPermission = async (grants, code, targetOfficeId) => {
  const matching = holding(grants, code);
  if (matching.length === 0) return false;
  if (!targetOfficeId) return true;
  if (!READ_ALL_OF.has(code)) return coversOffice(matching, targetOfficeId);

  if (isSuperAdmin(grants) || matching.some((grant) => ownOfficeOf(grant) === targetOfficeId)) return true;
  const readAll = holding(grants, READ_ALL_OF.get(code));
  return readAll.length > 0 && coversOffice(readAll, targetOfficeId);
};

/**
 * Whether a role's scope stretches to an office (null = university-wide), whatever the code. A person can hand a role
 * to an office below without being able to read that office's records.
 */
export const reachesOffice = async (grants, code, scopeOfficeId) => {
  const matching = holding(grants, code);
  if (matching.length === 0) return false;
  return scopeOfficeId ? coversOffice(matching, scopeOfficeId) : matching.some((grant) => grant.scopeOfficeId === null);
};

/**
 * True only for a university-wide grant (scopeOfficeId = null) of the code, or the Super Admin wildcard.
 * Use for actions that are not tied to one office (e.g. defining office types, creating the root office).
 */
export const hasGlobalPermission = (grants, code) => holding(grants, READ_ALL_OF.get(code) ?? code).some((grant) => grant.scopeOfficeId === null);

/**
 * Distinct permission codes a person currently holds (any scope).
 */
export const getPermissionCodes = (grants) => [...new Set(grants.map((grant) => grant.code))].sort();

export default { getActiveGrants, getOfficeAncestorIds, isSuperAdmin, ownOfficeOf, hasPermission, reachesOffice, hasGlobalPermission, getPermissionCodes };
