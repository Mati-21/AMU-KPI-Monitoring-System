import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { api, BASE_URL } from '../../../api/axios';
import { useSocket } from '../../../Context/SocketContext';
import { getFileUrl } from '../../../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../Config/queryKeys';
import { 
  useConversationsQuery, 
  useChatHistoryQuery, 
  useSendMessageMutation, 
  useDeleteMessageMutation,
  useMarkAsReadMutation
} from '../../../Hooks/Queries/useMessaging';
import { 
  Search, 
  Send, 
  Trash2, 
  Paperclip, 
  Smile, 
  MoreHorizontal, 
  ChevronLeft, 
  Plus, 
  Download, 
  X, 
  ChevronRight, 
  Phone, 
  Video, 
  Image as ImageIcon, 
  File, 
  Loader2,
  Check,
  CheckCheck,
  MessageSquare
} from 'lucide-react';

const COMMON_EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '🙏', '🔥', '❤️', '🙌', '🎉', '😎', '✨', '😢', '😮', '👏', '🤝', '✅', '🚀'];

const DirectMessageView = () => {
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);
  const queryClient = useQueryClient();
  
  const [activeChat, setActiveChat] = useState(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteAttachmentInfo, setDeleteAttachmentInfo] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  // Queries
  const { data: contacts = [] } = useConversationsQuery();
  const { data: chatHistory = [], isLoading: isLoadingMessages } = useChatHistoryQuery(activeChat?.Id);
  
  // Mutations
  const sendMessageMutation = useSendMessageMutation();
  const deleteMessageMutation = useDeleteMessageMutation();
  const markAsReadMutation = useMarkAsReadMutation();
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const socket = useSocket();

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('messages:new', (newMsg) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      
      const isFromActive = activeChat && String(newMsg.SenderId) === String(activeChat.Id);
      const isToActive = activeChat && String(newMsg.ReceiverId) === String(activeChat.Id);
      
      if (isFromActive || isToActive) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messaging.chat(activeChat.Id) });
      }
    });

    socket.on('messages:deleted', ({ messageId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      if (activeChat) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messaging.chat(activeChat.Id) });
      }
    });

    return () => {
      socket.off('messages:new');
      socket.off('messages:deleted');
    };
  }, [socket, activeChat, queryClient]);



  // Search users
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        setIsSearching(true);
        try {
          const res = await api.get(`/messages/search?query=${searchQuery}`);
          setSearchResults(res.data.data);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);



  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!message.trim() && pendingFiles.length === 0) || !activeChat) return;

    const currentMessage = message;
    setMessage('');
    
    try {
      const payload = {
        receiverId: activeChat.Id,
        content: currentMessage.trim() || null
      };

      if (pendingFiles.length > 0) {
        setIsUploading(true);
        const uploadedAttachments = [];
        
        for (const fileItem of pendingFiles) {
          const formData = new FormData();
          formData.append('file', fileItem.file);

          const uploadRes = await api.post('/messages/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          uploadedAttachments.push(uploadRes.data.data);
        }
        
        payload.attachments = uploadedAttachments;
        setPendingFiles([]);
      }

      if (payload.content || (payload.attachments && payload.attachments.length > 0)) {
        sendMessageMutation.mutate(payload);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const selectUser = (user) => {
    setActiveChat(user);
    setSearchQuery('');
    setSearchResults([]);
    
    // Add to contacts if not exists
    if (!contacts.find(c => c.Id === user.Id)) {
      setContacts(prev => [user, ...prev]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !activeChat) return;

    const newPending = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.originalname || file.name,
      type: file.type
    }));

    setPendingFiles(prev => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (id) => {
    setPendingFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // Clean up blob URLs
      const removed = prev.find(f => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const addEmoji = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async (messageId) => {
    deleteMessageMutation.mutate(messageId, {
      onSuccess: () => {
        setDeleteConfirmId(null);
      },
      onError: () => {
        setDeleteConfirmId(null);
      }
    });
  };

  const handleDeleteAttachment = async () => {
    if (!deleteAttachmentInfo) return;
    const { messageId, attachmentUrl } = deleteAttachmentInfo;
    
    try {
      await api.post('/messages/delete-attachment', { messageId, attachmentUrl });
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all });
      setDeleteAttachmentInfo(null);
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      setDeleteAttachmentInfo(null);
    }
  };

  const handleDownload = async (url, fileName) => {
    try {
      const response = await fetch(getFileUrl(url));
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getFileIcon = (fileType, fileName = '') => {
    const type = fileType?.toLowerCase() || '';
    const name = fileName?.toLowerCase() || '';
    
    if (type.includes('pdf') || name.endsWith('.pdf')) return '/PdfIcon.png';
    if (type.includes('word') || type.includes('officedocument.wordprocessingml') || name.endsWith('.doc') || name.endsWith('.docx')) return '/WordIcon.png';
    if (type.includes('excel') || type.includes('officedocument.spreadsheetml') || type.includes('csv') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return '/ExcelIcon.png';
    return null;
  };

  const markChatAsRead = async (userId) => {
    markAsReadMutation.mutate(userId);
  };

  // Mark as read when active chat changes
  useEffect(() => {
    if (activeChat) {
      markChatAsRead(activeChat.Id);
    }
  }, [activeChat]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    chatHistory.forEach((msg) => {
      const date = new Date(msg.createdAt).toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.date !== date) {
        groups.push({ date, messages: [msg] });
      } else {
        lastGroup.messages.push(msg);
      }
    });

    // Label relative dates
    const today = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return groups.map(group => {
      let displayDate = group.date;
      if (group.date === today) displayDate = 'Today';
      else if (group.date === yesterday) displayDate = 'Yesterday';
      return { ...group, displayDate };
    });
  }, [chatHistory]);

  // Filter existing contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(contact => 
      contact.FirstName?.toLowerCase().includes(q) || 
      contact.FatherName?.toLowerCase().includes(q) ||
      contact.UserName?.toLowerCase().includes(q) ||
      contact.Email?.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  // Only show backend search results if they are not already in filtered contacts
  const displaySearchResults = useMemo(() => {
    return searchResults.filter(result => 
      !contacts.find(c => c.Id === result.Id)
    );
  }, [searchResults, contacts]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Left Sidebar - Conversation List */}
      <div className="w-80 border-r border-border flex flex-col bg-card/50">
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by username or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 h-10 bg-muted/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none border-none transition-all"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}

            {/* Search Results Dropdown */}
            {displaySearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                <div className="px-3 py-2 bg-muted/30 border-b border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Search</span>
                </div>
                {displaySearchResults.map((user) => (
                  <button
                    key={user.Id}
                    onClick={() => selectUser(user)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted transition-colors border-b border-border last:border-none"
                  >
                     <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs overflow-hidden border border-border/50">
                       {user.ProfilePicture ? (
                         <img src={getFileUrl(user.ProfilePicture)} alt="" className="h-full w-full object-cover" />
                       ) : (
                         <>{user.FirstName[0]}{user.FatherName[0]}</>
                       )}
                     </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-bold truncate">{user.FirstName} {user.FatherName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.UserName} • {user.Email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col">
          {filteredContacts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {searchQuery ? 'No results found' : 'Search for a user'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? 'We couldn\'t find any contacts matching your search.' : 'Start a conversation by searching for an officer or administrator above.'}
                </p>
              </div>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.Id}
                onClick={() => setActiveChat(contact)}
                className={`w-full flex items-center gap-3 p-4 transition-all relative ${
                  activeChat?.Id === contact.Id ? 'bg-primary/5' : 'hover:bg-muted/30'
                }`}
              >
                {activeChat?.Id === contact.Id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
                <div className="relative">
                   <div className={`w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shadow-sm uppercase overflow-hidden border border-border/50`}>
                     {contact.ProfilePicture ? (
                       <img src={getFileUrl(contact.ProfilePicture)} alt="" className="h-full w-full object-cover" />
                     ) : (
                       <>{contact.FirstName[0]}{contact.FatherName[0]}</>
                     )}
                   </div>
                  {contact.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-foreground truncate">{contact.FirstName} {contact.FatherName}</h4>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {contact.lastMessage ? new Date(contact.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {contact.lastMessage && contact.lastMessage.SenderId === currentUser.Id && (
                        contact.lastMessage.IsRead 
                          ? <CheckCheck className="w-3.5 h-3.5 text-primary shrink-0" /> 
                          : <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <p className={`text-xs truncate flex items-center gap-1 ${contact.unreadCount > 0 ? 'text-foreground font-bold' : 'text-muted-foreground italic'}`}>
                        {contact.lastMessage?.Attachments?.length > 0 && !contact.lastMessage?.Content && (
                          <span className="flex items-center gap-1 text-primary">
                            <Paperclip className="w-3 h-3" /> File
                          </span>
                        )}
                        {contact.lastMessage ? contact.lastMessage.Content : 'No messages yet'}
                      </p>
                    </div>
                    {contact.unreadCount > 0 && (
                      <div className="bg-primary text-primary-foreground text-[10px] font-bold h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Middle & 3. Right - Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeChat === null ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-background p-12 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Your Inbox is Empty</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              You haven't started any conversations yet. Use the search bar on the left to find a user and start messaging.
            </p>
          </div>
        ) : (
          <>
            {/* 2. Middle - Chat Window */}
            <div className="flex-1 flex flex-col bg-background relative border-r border-border">
              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scroll-smooth"
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 opacity-50">
                    <MessageSquare className="w-12 h-12" />
                    <p className="text-sm font-medium">Say hello to {activeChat.FirstName}!</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date} className="space-y-1.5">
                      <div className="flex justify-center py-4">
                        <span className="px-3 py-1 rounded-full bg-muted/80 text-[10px] font-bold text-muted-foreground uppercase tracking-wider shadow-sm border border-border/50">
                          {group.displayDate}
                        </span>
                      </div>
                      
                      {group.messages.map((msg) => {
                        const isOwn = msg.SenderId === currentUser.Id;
                        return (
                          <div key={msg.Id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            {!isOwn && (
                               <div className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold shrink-0 mb-1 shadow-sm uppercase overflow-hidden border border-border/50`}>
                                 {activeChat.ProfilePicture ? (
                                   <img src={getFileUrl(activeChat.ProfilePicture)} alt="" className="h-full w-full object-cover" />
                                 ) : (
                                   <>{activeChat.FirstName[0]}{activeChat.FatherName[0]}</>
                                 )}
                               </div>
                            )}
                            <div className="max-w-[85%] group relative">
                              <div className={`rounded-2xl text-sm leading-relaxed relative ${
                                msg.Content 
                                  ? (isOwn 
                                      ? 'bg-primary text-primary-foreground rounded-br-none min-w-[140px] pr-20 pl-4 py-1.5 shadow-sm' 
                                      : 'bg-muted/50 text-foreground rounded-bl-none border border-border/50 min-w-[110px] pr-16 pl-4 py-1.5 shadow-sm')
                                  : ''
                              }`}>
                                {msg.Attachments && msg.Attachments.length > 0 && (
                                  <div className={`grid gap-1.5 mb-2 ${msg.Attachments.length === 1 ? 'grid-cols-1 max-w-[150px]' : 'grid-cols-2 max-w-[200px]'}`}>
                                    {msg.Attachments.map((file, idx) => {
                                      // If odd number, the FIRST one takes full width
                                      const isOddStart = msg.Attachments.length % 2 !== 0 && idx === 0;
                                      return (
                                        <div 
                                          key={idx} 
                                          className={`relative group/item ${isOddStart && msg.Attachments.length > 1 ? 'col-span-2' : ''}`}
                                        >
                                          {file.fileType?.startsWith('image/') ? (
                                            <div className="relative overflow-hidden rounded-xl">
                                              <img 
                                                src={getFileUrl(file.fileUrl)} 
                                                alt={file.fileName} 
                                                onClick={() => setPreviewFile({ preview: getFileUrl(file.fileUrl), name: file.fileName, type: file.fileType })}
                                                className="w-full aspect-square object-cover border border-border/10 cursor-pointer hover:opacity-90 transition-opacity shadow-lg" 
                                              />
                                              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleDownload(file.fileUrl, file.fileName); }}
                                                  className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-primary transition-all backdrop-blur-sm"
                                                  title="Download"
                                                >
                                                  <Download className="w-3 h-3" />
                                                </button>
                                                {isOwn && (
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteAttachmentInfo({ messageId: msg.Id, attachmentUrl: file.fileUrl }); }}
                                                    className="p-1.5 rounded-lg bg-black/40 text-white hover:bg-destructive/80 transition-all backdrop-blur-sm"
                                                    title="Delete"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="relative h-full">
                                              <div className="flex flex-col h-full group/file">
                                                <a 
                                                  href={getFileUrl(file.fileUrl)} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className={`flex items-center gap-2 p-2 rounded-xl border border-border/30 h-full ${
                                                    isOwn ? 'bg-primary/20 text-foreground' : 'bg-muted text-foreground'
                                                  } hover:opacity-80 transition-opacity shadow-sm`}
                                                >
                                                  <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                                                    {getFileIcon(file.fileType, file.fileName) ? (
                                                      <img src={getFileIcon(file.fileType, file.fileName)} alt="" className="w-6 h-6 object-contain" />
                                                    ) : (
                                                      <File className="w-4 h-4 text-primary" />
                                                    )}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] font-bold truncate leading-tight">{file.fileName}</p>
                                                    <p className="text-[8px] opacity-60 uppercase">
                                                      {file.fileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                                    </p>
                                                  </div>
                                                </a>
                                                <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(file.fileUrl, file.fileName); }}
                                                    className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                                    title="Download"
                                                  >
                                                    <Download className="w-2.5 h-2.5" />
                                                  </button>
                                                  {isOwn && (
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); setDeleteAttachmentInfo({ messageId: msg.Id, attachmentUrl: file.fileUrl }); }}
                                                      className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                                      title="Delete"
                                                    >
                                                      <Trash2 className="w-2.5 h-2.5" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {msg.FileUrl && !msg.Attachments && (
                                  <div className={`mb-2 max-w-[150px]`}>
                                    {msg.FileType?.startsWith('image/') ? (
                                      <img 
                                        src={getFileUrl(msg.FileUrl)} 
                                        alt={msg.FileName} 
                                        className="rounded-xl object-cover border border-border/10 shadow-lg cursor-pointer" 
                                        onClick={() => setPreviewFile({ preview: getFileUrl(msg.FileUrl), name: msg.FileName, type: msg.FileType })}
                                      />
                                    ) : (
                                      <a 
                                        href={getFileUrl(msg.FileUrl)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-3 p-3 rounded-xl border border-border/30 ${
                                          isOwn ? 'bg-primary/20' : 'bg-muted'
                                        } hover:opacity-80 transition-opacity shadow-sm`}
                                      >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                                          {getFileIcon(msg.FileType, msg.FileName) ? (
                                            <img src={getFileIcon(msg.FileType, msg.FileName)} alt="" className="w-7 h-7 object-contain" />
                                          ) : (
                                            <File className="w-5 h-5 text-primary" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold truncate">{msg.FileName}</p>
                                          <p className="text-[10px] opacity-60">
                                            {msg.FileType?.split('/')[1]?.toUpperCase() || 'FILE'}
                                          </p>
                                        </div>
                                        <Download className="w-4 h-4 opacity-40" />
                                      </a>
                                    )}
                                  </div>
                                )}
                                
                                {msg.Content && (
                                  <p className={`${msg.FileUrl || (msg.Attachments && msg.Attachments.length > 0) ? 'text-xs' : ''} whitespace-pre-wrap break-words`}>{msg.Content}</p>
                                )}
                                
                                <div className={`flex items-center gap-1.5 text-[9px] font-medium mt-1 ${
                                  msg.Content 
                                    ? 'absolute bottom-1.5 right-2.5' 
                                    : ''
                                } ${
                                  isOwn 
                                    ? (msg.Content ? 'text-primary-foreground/80' : 'text-muted-foreground/70') 
                                    : 'text-muted-foreground/70'
                                }`}>
                                  <span className="whitespace-nowrap">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {isOwn && (
                                    msg.IsRead 
                                      ? <CheckCheck className="w-3 h-3 text-emerald-400" /> 
                                      : <Check className="w-3 h-3" />
                                  )}
                                </div>
                              </div>

                                {isOwn && (
                                  <button
                                    onClick={() => setDeleteConfirmId(msg.Id)}
                                    className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground/0 group-hover:text-destructive/60 hover:bg-destructive/10 transition-all"
                                    title="Delete for everyone"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ))
                )}
              </div>

              {/* Deletion Modal (Universal) */}
              {(deleteConfirmId || deleteAttachmentInfo) && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <Trash2 className="w-6 h-6 text-destructive" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-foreground">
                          {deleteAttachmentInfo ? 'Delete File?' : 'Delete Message?'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          This will permanently remove this {deleteAttachmentInfo ? 'file' : 'message'} for everyone in this chat.
                        </p>
                      </div>
                      <div className="flex gap-3 w-full pt-2">
                        <button 
                          onClick={() => { setDeleteConfirmId(null); setDeleteAttachmentInfo(null); }}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-muted font-bold text-sm transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={deleteAttachmentInfo ? handleDeleteAttachment : () => handleDeleteMessage(deleteConfirmId)}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold text-sm transition-colors shadow-lg shadow-destructive/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-card/30">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  multiple
                  className="hidden" 
                />
                <div className="bg-background rounded-2xl border border-border p-2 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all relative">
                  {/* Pending Files Tray */}
                  {pendingFiles.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-4 flex gap-2 overflow-x-auto p-3 bg-card border border-border rounded-2xl shadow-xl animate-in slide-in-from-bottom-2">
                      {pendingFiles.map(file => (
                        <div key={file.id} className="relative group shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary transition-all"
                          >
                            {file.preview ? (
                              <img src={file.preview} alt="" className="w-full h-full object-cover" />
                            ) : getFileIcon(file.type, file.name) ? (
                              <img src={getFileIcon(file.type, file.name)} alt="" className="w-10 h-10 object-contain" />
                            ) : (
                              <File className="w-6 h-6 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => removePendingFile(file.id)}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg scale-0 group-hover:scale-100 transition-transform"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input 
                    type="text" 
                    placeholder={isUploading ? "Uploading files..." : `Message ${activeChat.FirstName}...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isUploading}
                    className="flex-1 bg-transparent border-none outline-none text-sm px-2 disabled:opacity-50"
                  />
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-4 p-2 bg-card border border-border rounded-2xl shadow-2xl z-50 grid grid-cols-6 gap-1 w-48 animate-in slide-in-from-bottom-2 duration-200">
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    type="submit"
                    disabled={(!message.trim() && pendingFiles.length === 0) || isUploading}
                    className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {/* Large Preview Modal */}
              {previewFile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="max-w-4xl max-h-[80vh] w-full p-4 flex flex-col items-center">
                    {previewFile.preview ? (
                      <img src={previewFile.preview} alt="" className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl" />
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center overflow-hidden">
                          {getFileIcon(previewFile.type, previewFile.name) ? (
                            <img src={getFileIcon(previewFile.type, previewFile.name)} alt="" className="w-16 h-16 object-contain" />
                          ) : (
                            <File className="w-12 h-12 text-primary" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold text-white mb-2">{previewFile.name}</p>
                          <p className="text-sm text-white/50 uppercase tracking-widest">{previewFile.type}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Right Sidebar - Details */}
            <div className="w-72 bg-card/20 flex flex-col">
              <div className="p-8 text-center flex flex-col items-center space-y-4">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center text-2xl text-primary font-bold shadow-md uppercase">
                    {activeChat.FirstName[0]}{activeChat.FatherName[0]}
                  </div>
                  {activeChat.online && (
                    <div className="absolute bottom-2 right-0 w-5 h-5 bg-emerald-500 border-4 border-background rounded-full shadow-sm" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{activeChat.FirstName} {activeChat.FatherName}</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-1">@{activeChat.UserName}</p>
                </div>

                <div className="flex gap-2 w-full pt-2">
                  <button className="flex-1 h-10 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center gap-2 text-xs font-bold transition-colors">
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </button>
                  <button className="flex-1 h-10 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center gap-2 text-xs font-bold transition-colors">
                    <Video className="w-3.5 h-3.5" />
                    Video
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                {/* Information Section */}
                <div className="space-y-4 border-t border-border/50 pt-4">
                  <div className="flex flex-col gap-1 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email Address</span>
                    <span className="text-xs text-foreground font-medium truncate">{activeChat.Email}</span>
                  </div>
                  <div className="flex flex-col gap-1 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</span>
                    <span className="text-xs text-foreground font-medium truncate">
                      {activeChat.UserRoles?.[0]?.Role?.RoleName || 'Staff Member'}
                    </span>
                  </div>
                </div>

                {/* Shared Photos Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Shared photos
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      'bg-orange-400', 'bg-emerald-400', 'bg-rose-400', 
                      'bg-indigo-400', 'bg-pink-400', 'bg-sky-400'
                    ].map((color, i) => (
                      <div key={i} className={`aspect-square rounded-lg ${color}/20 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                        <ImageIcon className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default DirectMessageView;
