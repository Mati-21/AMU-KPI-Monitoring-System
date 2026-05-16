// hooks/useRole.js
import { useSelector } from 'react-redux';

export const useRole = () => {
  const user = useSelector((state) => state.auth.user);
  return user?.role || 'user';
};
