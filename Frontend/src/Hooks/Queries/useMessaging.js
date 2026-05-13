import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/axios';
import { queryKeys } from '../../Config/queryKeys';

/**
 * Hook for fetching recent conversations
 */
export const useConversationsQuery = () => {
  return useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: async () => {
      const response = await api.get('/messages/conversations');
      return response.data?.data || [];
    },
  });
};

/**
 * Hook for fetching chat history with a specific user
 */
export const useChatHistoryQuery = (userId) => {
  return useQuery({
    queryKey: queryKeys.messaging.history(userId),
    queryFn: async () => {
      if (!userId) return [];
      const response = await api.get(`/messages/history/${userId}`);
      return response.data?.data || [];
    },
    enabled: !!userId,
  });
};

/**
 * Hook for sending a message
 */
export const useSendMessageMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/messages/send', payload);
      return response.data?.data;
    },
    onSuccess: (newMsg) => {
      // Update history and conversations
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.unreadCount });
      
      // Optmistically update or just invalidate history
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.history(newMsg.ReceiverId) });
    },
  });
};

/**
 * Hook for deleting a message
 */
export const useDeleteMessageMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (messageId) => {
      await api.delete(`/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
    },
  });
};

/**
 * Hook for marking messages as read
 */
export const useMarkAsReadMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId) => {
      await api.patch(`/messages/read/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.unreadCount });
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
    },
  });
};

/**
 * Hook for fetching unread messages count
 */
export const useUnreadMessagesCountQuery = () => {
  return useQuery({
    queryKey: queryKeys.messaging.unreadCount,
    queryFn: async () => {
      const response = await api.get('/messages/unread-count');
      return response.data?.data?.unread || 0;
    },
  });
};
