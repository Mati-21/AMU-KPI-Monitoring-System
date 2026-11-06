import { useEffect, useMemo, useRef, useState } from 'react';
import { File, Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { api } from '../../../shared/api/axios';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDay } from '../../../shared/lib/ethiopianDate';
import { getFileUrl } from '../../../shared/lib/utils';
import { PersonAvatar } from '../../01-identity/components/PersonAvatar';
import Composer from '../components/Composer';
import ContactPanel from '../components/ContactPanel';
import ConversationList from '../components/ConversationList';
import MessageBubble from '../components/MessageBubble';
import {
  useChatHistoryQuery,
  useConversationsQuery,
  useDeleteAttachmentMutation,
  useDeleteMessageMutation,
  useMarkAsReadMutation,
  useMessageSearchQuery,
  useSendMessageMutation,
} from '../hooks/useMessaging';
import { fileIconOf, fullNameOf } from '../lib/messageFormat';

const SEARCH_DELAY_MS = 300;

const useDebounced = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/**
 * Messages grouped by calendar day, each group labelled Today, Yesterday or the date.
 */
const groupByDay = (messages) => {
  const today = formatEthiopianDay(new Date());
  const yesterday = formatEthiopianDay(new Date(Date.now() - 86_400_000));
  const groups = [];
  for (const message of messages) {
    const day = formatEthiopianDay(message.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.messages.push(message);
    else groups.push({ day, label: day === today ? 'Today' : day === yesterday ? 'Yesterday' : day, messages: [message] });
  }
  return groups;
};

const DirectMessageView = () => {
  const myId = useSelector((state) => state.auth.user?.personId);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null); // { messageId, fileId? }
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');
  const scrollRef = useRef(null);

  const { data: conversations = [] } = useConversationsQuery();
  const { data: searchResults = [], isFetching: isSearching } = useMessageSearchQuery(useDebounced(search, SEARCH_DELAY_MS));
  const { data: history = [], isLoading: isLoadingHistory } = useChatHistoryQuery(selected?.id);
  const sendMessage = useSendMessageMutation();
  const deleteMessage = useDeleteMessageMutation();
  const deleteAttachment = useDeleteAttachmentMutation();
  const { mutate: markRead } = useMarkAsReadMutation();

  // The conversation list is the freshest copy of the person; a person found by search is used until they have one
  const person = conversations.find((item) => item.person.id === selected?.id)?.person ?? selected;
  const groups = useMemo(() => groupByDay(history), [history]);
  const hasUnread = history.some((message) => message.senderId === selected?.id && !message.isRead);

  useEffect(() => {
    if (hasUnread) markRead(selected.id);
  }, [hasUnread, selected?.id, markRead]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, selected?.id]);

  const open = (target) => {
    setSelected(target);
    setSearch('');
    setNotice('');
  };

  const confirmDelete = () => {
    const { messageId, fileId } = toDelete;
    const options = { onSettled: () => setToDelete(null), onError: (error) => setNotice(apiErrorMessage(error, 'Could not delete that.')) };
    if (fileId) deleteAttachment.mutate({ messageId, fileId }, options);
    else deleteMessage.mutate(messageId, options);
  };

  const download = async (file) => {
    try {
      const { data } = await api.get(getFileUrl(file.fileUrl), { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = Object.assign(document.createElement('a'), { href: url, download: file.fileName || 'download' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(apiErrorMessage(error, 'The download failed.'));
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      <ConversationList
        myId={myId}
        conversations={conversations}
        search={search}
        onSearchChange={setSearch}
        searchResults={searchResults}
        isSearching={isSearching}
        activeId={selected?.id}
        onSelect={open}
      />

      {!person ? (
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/5">
            <MessageSquare className="h-10 w-10 text-primary/40" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Direct messages</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Pick a conversation, or search for a colleague on the left to start a new one.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex flex-1 flex-col border-r border-border bg-background">
            <div className="flex items-center gap-3 border-b border-border px-6 py-3">
              <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={fullNameOf(person)} className="h-9 w-9 text-xs" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{fullNameOf(person)}</p>
                {person.position && <p className="truncate text-xs text-muted-foreground">{person.position}</p>}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto scroll-smooth p-6">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : groups.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-2 text-muted-foreground opacity-60">
                  <MessageSquare className="h-12 w-12" />
                  <p className="text-sm font-medium">Say hello to {person.firstName}!</p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.day} className="space-y-1.5">
                    <div className="flex justify-center py-4">
                      <span className="rounded-full border border-border/50 bg-muted/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm">{group.label}</span>
                    </div>
                    {group.messages.map((message) => {
                      const isOwn = message.senderId === myId;
                      return (
                        <div key={message.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {!isOwn && <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={fullNameOf(person)} className="mb-1 h-8 w-8 shrink-0 text-[10px]" />}
                          <MessageBubble
                            message={message}
                            isOwn={isOwn}
                            onPreview={setPreview}
                            onDownload={download}
                            onDelete={(messageId) => setToDelete({ messageId })}
                            onDeleteAttachment={(messageId, fileId) => setToDelete({ messageId, fileId })}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {notice && <p className="px-6 pb-2 text-xs text-red-500">{notice}</p>}

            <Composer
              key={person.id}
              name={person.firstName}
              isSending={sendMessage.isPending}
              onPreview={setPreview}
              onSend={({ content, files }) => sendMessage.mutateAsync({ receiverId: person.id, content, files })}
            />

            {toDelete && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm">
                <div className="mx-4 w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                    <Trash2 className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground">{toDelete.fileId ? 'Delete file?' : 'Delete message?'}</h3>
                    <p className="text-sm text-muted-foreground">This removes it for everyone in this chat and cannot be undone.</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setToDelete(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-muted">
                      Cancel
                    </button>
                    <button type="button" onClick={confirmDelete} className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ContactPanel person={person} messages={history} onPreview={setPreview} />
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-6 w-6" />
          </button>
          <div className="flex max-h-[80vh] w-full max-w-4xl flex-col items-center p-4" onClick={(event) => event.stopPropagation()}>
            {preview.preview ? (
              <img src={preview.preview} alt={preview.name} className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl" />
            ) : (
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-primary/20">
                  {fileIconOf(preview.type, preview.name) ? <img src={fileIconOf(preview.type, preview.name)} alt="" className="h-16 w-16 object-contain" /> : <File className="h-12 w-12 text-primary" />}
                </div>
                <div className="text-center">
                  <p className="mb-2 text-xl font-bold text-white">{preview.name}</p>
                  <p className="text-sm uppercase tracking-widest text-white/50">{preview.type}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectMessageView;
