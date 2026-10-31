export const SUPER_ADMIN_PERMISSION = '*';

const fullNameOf = (person) => [person?.firstName, person?.middleName, person?.lastName].filter(Boolean).join(' ');

const roleNamesOf = (placements = []) => [...new Set(placements.flatMap((placement) => placement.roles.map((assignment) => assignment.role.name)))];

/**
 * Turn GET /auth/me into the signed-in user the app keeps.
 * The role name is only for display: what a person may do comes from their permission codes.
 */
export const normalizeAuthUser = (profile) => {
  if (!profile) return null;
  const permissions = profile.permissions ?? [];
  const isSuperAdmin = permissions.includes(SUPER_ADMIN_PERMISSION);
  const roles = roleNamesOf(profile.placements);
  const roleName = isSuperAdmin ? 'Super Admin' : roles[0] || 'User';
  const fullName = fullNameOf(profile.person) || profile.username;

  return {
    ...profile,
    fullName,
    name: fullName,
    email: profile.person?.email ?? null,
    phone: profile.person?.phone ?? null,
    profilePictureFileId: profile.person?.profilePictureFileId ?? null,
    roles,
    role: roleName,
    roleName,
    isSuperAdmin,
    permissions,
    permissionKeys: permissions,
  };
};
