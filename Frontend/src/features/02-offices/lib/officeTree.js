/**
 * The tree as a flat list, parents first, with each office's depth.
 */
export const flattenTree = (nodes = [], depth = 0) => nodes.flatMap((node) => [{ ...node, depth }, ...flattenTree(node.children, depth + 1)]);

export const findOffice = (nodes = [], id) => flattenTree(nodes).find((node) => node.id === id) ?? null;

/**
 * Select options showing the hierarchy, for active offices only. An office in `except` is left out with everything below it.
 */
export const officeOptions = (nodes = [], { except } = {}) => {
  const pick = (list, depth) =>
    list
      .filter((node) => node.id !== except)
      .flatMap((node) => [...(node.isActive ? [{ value: node.id, label: `${'— '.repeat(depth)}${node.name}` }] : []), ...pick(node.children, depth + 1)]);
  return pick(nodes, 0);
};

/**
 * Keeps offices matching the search, together with the parents that lead to them.
 */
export const filterTree = (nodes = [], search = '') => {
  const text = search.trim().toLowerCase();
  if (!text) return nodes;
  return nodes.flatMap((node) => {
    const matches = node.name.toLowerCase().includes(text) || node.code?.toLowerCase().includes(text);
    const children = filterTree(node.children, text);
    return matches || children.length > 0 ? [{ ...node, children }] : [];
  });
};

/**
 * Ids of the offices with children at the given depth or deeper.
 */
export const collapsedFromDepth = (nodes = [], depth = 0) => new Set(flattenTree(nodes).filter((node) => node.depth >= depth && node.children.length > 0).map((node) => node.id));

export const todayIso =() => new Date().toISOString().slice(0, 10);

// Stored as calendar dates, so they must not shift with the viewer's time zone
export const formatDate = (date) => (date ? new Date(date).toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : '');
