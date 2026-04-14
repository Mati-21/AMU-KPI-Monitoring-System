const STORAGE_KEY = 'amu-role-directory';

const defaultRoleDirectory = {
  categories: [
    { id: 'cat-1', name: 'Academic', description: 'Academic and teaching roles' },
    { id: 'cat-2', name: 'Administrative', description: 'Administrative and operations roles' },
    { id: 'cat-3', name: 'Support', description: 'Support and service roles' },
    { id: 'cat-4', name: 'Management', description: 'Leadership and management roles' },
  ],
  roles: [
    {
      id: 'role-1',
      roleName: 'Dean',
      description: 'Faculty-level management and KPI distribution owner',
      roleCategory: 'Academic',
      parentRole: 'Vice President',
      extraMeasure: false,
    },
    {
      id: 'role-2',
      roleName: 'Chair',
      description: 'Department-level owner of synthetic KPI assignment',
      roleCategory: 'Academic',
      parentRole: 'Dean',
      extraMeasure: false,
    },
    {
      id: 'role-3',
      roleName: 'System Administrator',
      description: 'Maintains users, access, and system configuration',
      roleCategory: 'Administrative',
      parentRole: 'Strategic Office',
      extraMeasure: false,
    },
    {
      id: 'role-4',
      roleName: 'Vice President',
      description: 'Owns higher institution KPIs and approvals',
      roleCategory: 'Management',
      parentRole: 'Strategic Office',
      extraMeasure: true,
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const readDirectory = () => {
  if (typeof window === 'undefined') return clone(defaultRoleDirectory);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRoleDirectory));
      return clone(defaultRoleDirectory);
    }

    const parsed = JSON.parse(stored);
    if (!parsed?.categories || !parsed?.roles) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRoleDirectory));
      return clone(defaultRoleDirectory);
    }

    return parsed;
  } catch {
    return clone(defaultRoleDirectory);
  }
};

const writeDirectory = (directory) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(directory));
};

export const getRoleDirectory = () => readDirectory();

export const getRoleCategories = () => readDirectory().categories;

export const getRoles = () => readDirectory().roles;
export const getAllRoleNames = () =>
  getRoles()
    .map((role) => role.roleName)
    .filter(Boolean);

export const getRolesByCategory = (categoryName) => getRoles().filter((role) => role.roleCategory === categoryName);

export const getRoleNamesByCategory = (categoryName) => getRolesByCategory(categoryName).map((role) => role.roleName);

export const addRoleCategory = ({ category, description }) => {
  const trimmedCategory = (category || '').trim();
  const trimmedDescription = (description || '').trim();
  if (!trimmedCategory) {
    return { ok: false, message: 'Role category is required.' };
  }

  const directory = readDirectory();
  const exists = directory.categories.some((item) => item.name.toLowerCase() === trimmedCategory.toLowerCase());

  if (exists) {
    return { ok: false, message: 'Role category already exists.' };
  }

  directory.categories.push({
    id: `cat-${Date.now()}`,
    name: trimmedCategory,
    description: trimmedDescription,
  });

  writeDirectory(directory);
  return { ok: true, message: 'Role category saved successfully.' };
};

export const addRole = ({ category, roleName, description, parentRole, extraMeasure }) => {
  const trimmedCategory = (category || '').trim();
  const trimmedRole = (roleName || '').trim();
  const trimmedDescription = (description || '').trim();
  const trimmedParent = (parentRole || '').trim();

  if (!trimmedRole) return { ok: false, message: 'Role name is required.' };

  const directory = readDirectory();
  if (trimmedCategory) {
    const categoryExists = directory.categories.some((item) => item.name === trimmedCategory);
    if (!categoryExists) return { ok: false, message: 'Selected role category is not registered.' };
  }

  const duplicate = directory.roles.some(
    (role) => role.roleCategory === trimmedCategory && role.roleName.toLowerCase() === trimmedRole.toLowerCase()
  );

  if (duplicate) {
    return { ok: false, message: 'Role already exists in the selected category.' };
  }

  directory.roles.push({
    id: `role-${Date.now()}`,
    roleName: trimmedRole,
    description: trimmedDescription,
    roleCategory: trimmedCategory,
    parentRole: trimmedParent,
    extraMeasure: Boolean(extraMeasure),
  });

  writeDirectory(directory);
  return { ok: true, message: 'Role saved successfully.' };
};

export const updateRoleCategory = (categoryId, { name, description }) => {
  const trimmedName = (name || '').trim();
  const trimmedDescription = (description || '').trim();
  if (!trimmedName) {
    return { ok: false, message: 'Role category name is required.' };
  }

  const directory = readDirectory();
  const index = directory.categories.findIndex((item) => item.id === categoryId);
  if (index < 0) {
    return { ok: false, message: 'Role category not found.' };
  }

  const oldName = directory.categories[index].name;
  const duplicate = directory.categories.some((item) => item.id !== categoryId && item.name.toLowerCase() === trimmedName.toLowerCase());

  if (duplicate) {
    return { ok: false, message: 'Another role category with this name already exists.' };
  }

  directory.categories[index] = {
    ...directory.categories[index],
    name: trimmedName,
    description: trimmedDescription,
  };

  if (oldName !== trimmedName) {
    directory.roles = directory.roles.map((role) => (role.roleCategory === oldName ? { ...role, roleCategory: trimmedName } : role));
  }

  writeDirectory(directory);
  return { ok: true, message: 'Role category updated successfully.' };
};

export const deleteRoleCategory = (categoryId) => {
  const directory = readDirectory();
  const category = directory.categories.find((item) => item.id === categoryId);

  if (!category) {
    return { ok: false, message: 'Role category not found.' };
  }

  const usedByRoles = directory.roles.some((role) => role.roleCategory === category.name);
  if (usedByRoles) {
    return {
      ok: false,
      message: 'Cannot delete this category because one or more roles are assigned to it.',
    };
  }

  directory.categories = directory.categories.filter((item) => item.id !== categoryId);
  writeDirectory(directory);
  return { ok: true, message: 'Role category deleted successfully.' };
};

export const updateRole = (roleId, { category, roleName, description, parentRole, extraMeasure }) => {
  const trimmedCategory = (category || '').trim();
  const trimmedRoleName = (roleName || '').trim();
  const trimmedDescription = (description || '').trim();
  const trimmedParentRole = (parentRole || '').trim();

  if (!trimmedRoleName) return { ok: false, message: 'Role name is required.' };

  const directory = readDirectory();
  const roleIndex = directory.roles.findIndex((role) => role.id === roleId);
  if (roleIndex < 0) return { ok: false, message: 'Role not found.' };

  if (trimmedCategory) {
    const categoryExists = directory.categories.some((item) => item.name === trimmedCategory);
    if (!categoryExists) return { ok: false, message: 'Selected role category is not registered.' };
  }

  const duplicate = directory.roles.some(
    (role) => role.id !== roleId && role.roleCategory === trimmedCategory && role.roleName.toLowerCase() === trimmedRoleName.toLowerCase()
  );

  if (duplicate) return { ok: false, message: 'Another role with this name already exists in this category.' };

  directory.roles[roleIndex] = {
    ...directory.roles[roleIndex],
    roleCategory: trimmedCategory,
    roleName: trimmedRoleName,
    description: trimmedDescription,
    parentRole: trimmedParentRole,
    extraMeasure: Boolean(extraMeasure),
  };

  writeDirectory(directory);
  return { ok: true, message: 'Role updated successfully.' };
};

export const deleteRole = (roleId) => {
  const directory = readDirectory();
  const role = directory.roles.find((item) => item.id === roleId);

  if (!role) return { ok: false, message: 'Role not found.' };

  directory.roles = directory.roles.filter((item) => item.id !== roleId);
  writeDirectory(directory);
  return { ok: true, message: 'Role deleted successfully.' };
};
