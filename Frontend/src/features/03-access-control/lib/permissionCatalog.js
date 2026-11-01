/**
 * The catalog from GET /permissions as one flat list, keeping each permission's module and resource.
 */
export const flattenCatalog = (catalog) =>
  (catalog?.modules ?? []).flatMap((module) =>
    module.resources.flatMap((resource) =>
      resource.permissions.map((permission) => ({
        ...permission,
        moduleName: module.name,
        resourceLabel: resource.label,
      }))
    )
  );

export const matchesPermission = (permission, search) => {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  return [permission.code, permission.description, permission.moduleName, permission.resourceLabel].some((value) => value.toLowerCase().includes(text));
};

/**
 * Rows split by module, in catalog order.
 */
export const groupByModule = (rows) => {
  const groups = new Map();
  for (const row of rows) groups.set(row.moduleName, [...(groups.get(row.moduleName) ?? []), row]);
  return [...groups].map(([moduleName, permissions]) => ({ moduleName, permissions }));
};
