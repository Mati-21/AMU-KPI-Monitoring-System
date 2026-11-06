import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { api } from '../../../shared/api/axios';
import { queryKeys } from '../../../shared/config/queryKeys';
import { useSocket } from '../../../shared/context/SocketContext';
import { playNotificationSound } from '../../09-notifications/lib/notificationSound';

/**
 * Direct messages. The server pushes messages:new, messages:deleted and messages:read, and every one of them
 * simply refreshes what is on screen, so the page and the navbar badge always agree.
 */

const UNREAD_REFRESH_MS = 60_000;

// Pages such as sign-in show the navbar too. A refused request there makes the server end a half-finished login,
// so nothing here may run before someone is signed in.
const useIsSignedIn = () => useSelector((state) => state.auth.isAuthenticated);

export const useConversationsQuery = () =>
  useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: () => api.get('/messages/conversations').then((response) => response.data.data),
    staleTime: 0,
  });

export const useChatHistoryQuery = (personId) =>
  useQuery({
    queryKey: queryKeys.messaging.history(personId),
    queryFn: () => api.get(`/messages/history/${personId}`).then((response) => response.data.data),
    enabled: Boolean(personId),
    staleTime: 0,
  });

export const useUnreadMessagesCountQuery = () => {
  const enabled = useIsSignedIn();
  return useQuery({
    queryKey: queryKeys.messaging.unreadCount,
    queryFn: () => api.get('/messages/unread-count').then((response) => response.data.data.unread),
    refetchInterval: UNREAD_REFRESH_MS,
    staleTime: 0,
    enabled,
  });
};

/**
 * People matching the text, for starting a new chat. Waits for at least two letters.
 */
export const useMessageSearchQuery = (text) => {
  const query = text.trim();
  return useQuery({
    queryKey: queryKeys.messaging.search(query),
    queryFn: () => api.get('/messages/search', { params: { query } }).then((response) => response.data.data),
    enabled: query.length >= 2,
  });
};

const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
};

/**
 * Upload each file, then send the message with them attached.
 */
export const useSendMessageMutation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ receiverId, content, files = [] }) => {
      const attachments = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/messages/upload', form);
        attachments.push({ fileId: data.data.fileId });
      }
      return api.post('/messages/send', { receiverId, content: content || undefined, attachments }).then((response) => response.data.data);
    },
    onSuccess: refresh,
  });
};

export const useDeleteMessageMutation = () => {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (messageId) => api.delete(`/messages/${messageId}`), onSuccess: refresh });
};

export const useDeleteAttachmentMutation = () => {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ messageId, fileId }) => api.delete(`/messages/${messageId}/attachments/${fileId}`), onSuccess: refresh });
};

export const useMarkAsReadMutation = () => {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (personId) => api.patch(`/messages/read/${personId}`), onSuccess: refresh });
};

/**
 * Listen for pushed messages: refresh the chats and chime for a message that is for me. Mount this once, in the layout.
 */
export const useMessagingRealtime = () => {
  const socket = useSocket();
  const refresh = useRefresh();
  const myId = useSelector((state) => state.auth.user?.personId);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (message) => {
      refresh();
      if (message.receiverId === myId && window.location.pathname !== '/direct-messages') playNotificationSound();
    };
    // After a dropped connection, anything sent meanwhile is only in the database
    const onReconnect = () => refresh();

    socket.on('messages:new', onNew);
    socket.on('messages:deleted', refresh);
    socket.on('messages:read', refresh);
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.off('messages:new', onNew);
      socket.off('messages:deleted', refresh);
      socket.off('messages:read', refresh);
      socket.io.off('reconnect', onReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, myId]);
};
