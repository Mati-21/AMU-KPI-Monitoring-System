/**
 * Centralized query keys for React Query.
 * Using a consistent object structure helps manage cache invalidation reliably.
 */
export const queryKeys = {
  users: {
    all: ['users'],
    list: (params) => [...queryKeys.users.all, 'list', params],
    detail: (id) => [...queryKeys.users.all, 'detail', id],
  },
  offices: {
    all: ['offices'],
    tree: ['offices', 'tree'],
    list: ['offices', 'list'],
    types: ['offices', 'types'],
    part: (officeId, name) => ['offices', officeId, name],
  },
  roles: {
    all: ['roles'],
    list: (params) => [...queryKeys.roles.all, 'list', params],
    permissions: ['roles', 'permissions'],
  },
  kpis: {
    all: ['kpis'],
    list: (params) => [...queryKeys.kpis.all, 'list', params],
    types: ['kpi-types'],
    units: ['units'],
    assignments: (params) => [...queryKeys.kpis.all, 'assignments', params],
    approvals: ['kpis', 'approvals'],
  },
  catalog: {
    all: ['catalog'],
    part: (name, params) => ['catalog', name, ...(params ? [params] : [])],
  },
  contracts: {
    all: ['contracts'],
    list: (fiscalYearId) => ['contracts', 'list', fiscalYearId],
    detail: (id) => ['contracts', 'detail', id],
    rejections: (fiscalYearId) => ['contracts', 'rejections', fiscalYearId],
  },
  messaging: {
    all: ['messages'],
    conversations: ['messages', 'conversations'],
    history: (userId) => ['messages', 'history', userId],
    unreadCount: ['messages', 'unread-count'],
  },
  notifications: {
    all: ['notifications'],
    unreadCount: ['notifications', 'unread-count'],
  },
  system: {
    settings: ['system-settings'],
    audit: ['audit-logs'],
  },
  dashboard: {
    admin: ['dashboard', 'admin'],
  }
};
