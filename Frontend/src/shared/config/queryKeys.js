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
  reports: {
    all: ['reports'],
    offices: (fiscalYearId) => ['reports', 'offices', fiscalYearId],
    sheet: (fiscalYearId, officeId) => ['reports', 'sheet', fiscalYearId, officeId],
    year: (fiscalYearId, officeId) => ['reports', 'year', fiscalYearId, officeId],
    list: (params) => ['reports', 'list', params],
    detail: (id) => ['reports', 'detail', id],
  },
  messaging: {
    all: ['messages'],
    conversations: ['messages', 'conversations'],
    history: (personId) => ['messages', 'history', personId],
    search: (query) => ['messages', 'search', query],
    unreadCount: ['messages', 'unread-count'],
  },
  notifications: {
    all: ['notifications'],
    list: (params) => ['notifications', 'list', params],
    unreadCount: ['notifications', 'unread-count'],
  },
  support: {
    all: ['support-requests'],
  },
  system: {
    settings: ['system-settings'],
    audit: ['audit-logs'],
  },
  dashboard: {
    all: ['dashboard'],
    system: ['dashboard', 'system'],
    systemUsage: (range) => ['dashboard', 'system', 'usage', range],
    me: (params) => ['dashboard', 'me', params],
    office: (officeId, params) => ['dashboard', 'office', officeId, params],
    below: (officeId, params) => ['dashboard', 'below', officeId, params],
    university: (params) => ['dashboard', 'university', params],
  },
};
