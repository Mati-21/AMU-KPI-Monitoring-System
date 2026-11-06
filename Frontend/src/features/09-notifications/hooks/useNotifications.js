import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';
import { useSocket } from '../../../shared/context/SocketContext';
import { playNotificationSound } from '../lib/notificationSound';

/**
 * The person's inbox. The bell and the Alerts page both read through these, so they always agree.
 */

const UNREAD_REFRESH_MS = 60_000;

// Pages such as sign-in show the navbar too. A request made there is refused, and the refused request makes the
// server end the half-finished login (its 2FA step cookie), so nothing here may run before someone is signed in.
const useIsSignedIn = () => useSelector((state) => state.auth.isAuthenticated);

export const useUnreadCount = () => {
  const enabled = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => api.get('/notifications/unread-count').then((response) => Number(response.data.data.count) || 0),
    refetchInterval: UNREAD_REFRESH_MS,
    staleTime: 0,
    enabled,
  });
};

export const useNotificationList = ({ page = 1, limit = 20, unreadOnly = false, enabled = true } = {}) => {
  const signedIn = useIsSignedIn();
  const params = { page, limit, ...(unreadOnly && { unreadOnly: true }) };
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.get('/notifications/my-notifications', { params }).then(({ data }) => ({ items: data.data, pagination: data.pagination })),
    placeholderData: keepPreviousData,
    staleTime: 0,
    enabled: enabled && signedIn,
  });
};

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
};

export const useMarkRead = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id) => api.patch(`/notifications/${id}/mark-read`), onSuccess: invalidate });
};

export const useMarkAllRead = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => api.patch('/notifications/mark-all-read'), onSuccess: invalidate });
};

/**
 * Listen for notifications pushed by the server: refresh the inbox and chime. Mount this once, in the layout.
 */
export const useNotificationRealtime = () => {
  const socket = useSocket();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = (notification) => {
      invalidate();
      // A new support request also puts a row in the support managers' list
      if (notification?.notificationType === 'SUPPORT_REQUEST') queryClient.invalidateQueries({ queryKey: queryKeys.support.all });
      playNotificationSound();
    };
    // After a dropped connection, anything sent meanwhile is only in the database
    const onReconnect = () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: queryKeys.support.all });
    };

    socket.on('notification', onNotification);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('notification', onNotification);
      socket.io.off('reconnect', onReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
};
