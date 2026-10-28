import { prisma } from '../../config/database.js';
import { SUPER_ADMIN_PERMISSION } from '../../config/permissions.js';

/**
 * Scoped RBAC resolution.
 *
 * A person's authority comes from OfficePersonRole rows on their *active* office placements.
 * Each grant is { code, scopeOfficeId }: scopeOfficeId = null means university-wide,
 * otherwise the permission applies only to that office and its descendants.
 */

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const activeWindow = (fromField, toField, today) => ({
  [fromField]: { lte: today },
  OR: [{ [toField]: null }, { [toField]: { gte: today } }],
});

/**
 * Load every currently-valid permission grant for a person.
 * @returns {Promise<Array<{ code: string, scopeOfficeId: string|null, roleId: number, roleName: string }>>}
 */
export const getActiveGrants = async (personId) => {
  const today = startOfTodayUtc();
  const assignments = await prisma.officePersonRole.findMany({
    where: {
      ...activeWindow('validFrom', 'validTo', today),
      officePerson: { personId, ...activeWindow('startDate', 'endDate', today) },
    },
    select: {
      scopeOfficeId: true,
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
    assignment.role.permissions.map(({ permission }) => ({
      code: permission.code,
      scopeOfficeId: assignment.scopeOfficeId,
      roleId: assignment.role.id,
      roleName: assignment.role.name,
    }))
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
 * Check a permission against loaded grants.
 * Without targetOfficeId: true if the code is held in any scope (route-level gate).
 * With targetOfficeId: true only if a grant is global or scoped to that office or one of its ancestors.
 */
export const hasPermission = async (grants, code, targetOfficeId) => {
  const matching = grants.filter((grant) => grant.code === code || grant.code === SUPER_ADMIN_PERMISSION);
  if (matching.length === 0) return false;
  if (!targetOfficeId) return true;
  if (matching.some((grant) => grant.scopeOfficeId === null)) return true;

  const ancestorIds = new Set(await getOfficeAncestorIds(targetOfficeId));
  return matching.some((grant) => ancestorIds.has(grant.scopeOfficeId));
};

/**
 * Distinct permission codes a person currently holds (any scope).
 */
export const getPermissionCodes = (grants) => [...new Set(grants.map((grant) => grant.code))].sort();

export default { getActiveGrants, getOfficeAncestorIds, isSuperAdmin, hasPermission, getPermissionCodes };
