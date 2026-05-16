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
  roles: {
    all: ['roles'],
    list: (params) => [...queryKeys.roles.all, 'list', params],
    categories: ['role-categories'],
  },
  kpis: {
    all: ['kpis'],
    list: (params) => [...queryKeys.kpis.all, 'list', params],
    types: ['kpi-types'],
    units: ['units'],
    assignments: (params) => [...queryKeys.kpis.all, 'assignments', params],
    approvals: ['kpis', 'approvals'],
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
  },
  dashboard: {
    admin: ['dashboard', 'admin'],
  }
};
