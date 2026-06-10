/**
 * useDashboardPermission.js
 * Custom hook that resolves whether the current user is allowed to view the dashboard.
 *
 * Rules:
 *  - Any authenticated user can view the dashboard (access is gated by route auth guards).
 *  - The hook additionally exposes whether the user can use the admin dashboard variant.
 */

import { useSelector } from 'react-redux';
import permissionUtils from '../lib/permissionUtils';

/**
 * @returns {{ canViewDashboard: boolean }}
 */
export const useDashboardPermission = () => {
  // Use the auth slice's reliable isAuthenticated flag — it is set to Boolean(user)
  // on login and cleared on logout, so it accurately reflects session state regardless
  // of what ID field shape the user object uses.
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return { canViewDashboard: isAuthenticated };
};
