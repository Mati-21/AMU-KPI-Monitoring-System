import { useSelector } from 'react-redux';
import permissionUtils from '../lib/permissionUtils';

/**
 * Whether the logged-in person holds any of these permission codes, such as can('user:read').
 * This only decides what to show. The backend still checks every request, including the office scope.
 */
export const useCan = () => {
  const permissions = useSelector((state) => state.auth.user?.permissions);
  return (...codes) => permissionUtils.hasPermission(permissions, codes);
};

export default useCan;
