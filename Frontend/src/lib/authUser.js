export const normalizeAuthUser = (user, role) => {
  if (!user) return null;

  const roleName = role?.RoleName || role?.roleName || user.roleName || user.RoleName || user.role || 'User';
  const fullName =
    user.FullName ||
    user.fullName ||
    [user.FirstName || user.firstName, user.FatherName || user.fatherName, user.GrandFatherName || user.grandFatherName].filter(Boolean).join(' ') ||
    'User';

  return {
    ...user,
    id: user.id || user.Id,
    roleId: role?.Id || role?.id || user.roleId || user.RoleId || null,
    name: fullName,
    fullName,
    role: roleName,
    roleName,
    permissions: Array.isArray(role?.Permissions)
      ? role.Permissions
      : Array.isArray(user.permissions)
        ? user.permissions
        : Array.isArray(user.Permissions)
          ? user.Permissions
          : [],
  };
};
