import { Check, CheckCheck, Loader2, Paperclip, Search } from 'lucide-react';
import { PersonAvatar } from '../../01-identity/components/PersonAvatar';
import { fullNameOf, previewOf } from '../lib/messageFormat';

const timeOf = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const PersonRow = ({ person, onClick, active = false, children }) => (
  <button type="button" onClick={onClick} className={`relative flex w-full items-center gap-3 border-b border-border/50 p-4 text-left transition-all last:border-none ${active ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
    {active && <div className="absolute bottom-0 left-0 top-0 w-1 rounded-r-full bg-primary" />}
    <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={fullNameOf(person)} className="h-11 w-11 shrink-0 text-xs" />
    <div className="min-w-0 flex-1">{children}</div>
  </button>
);

/**
 * Search box, people found by the search, and the chats I already have.
 */
const ConversationList = ({ myId, conversations, search, onSearchChange, searchResults, isSearching, activeId, onSelect }) => {
  const text = search.trim().toLowerCase();
  const visible = text ? conversations.filter(({ person }) => `${fullNameOf(person)} ${person.username ?? ''} ${person.email ?? ''}`.toLowerCase().includes(text)) : conversations;
  const known = new Set(conversations.map(({ person }) => person.id));
  const others = searchResults.filter((person) => !known.has(person.id));

  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, username or email"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full rounded-xl border-none bg-muted/50 pl-10 pr-10 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
          />
          {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {others.length > 0 && (
          <div>
            <p className="bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">People</p>
            {others.map((person) => (
              <PersonRow key={person.id} person={person} onClick={() => onSelect(person)}>
                <p className="truncate text-sm font-bold">{fullNameOf(person)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{person.position ?? person.email}</p>
              </PersonRow>
            ))}
          </div>
        )}

        {visible.length === 0 && others.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-2 p-6 text-center">
            <p className="text-sm font-bold text-foreground">{text ? 'No one found' : 'No conversations yet'}</p>
            <p className="text-xs text-muted-foreground">{text ? 'Try another name, username or email.' : 'Search for a colleague above to start a conversation.'}</p>
          </div>
        ) : (
          visible.map(({ person, lastMessage, unreadCount }) => (
            <PersonRow key={person.id} person={person} active={activeId === person.id} onClick={() => onSelect(person)}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-bold text-foreground">{fullNameOf(person)}</h4>
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{timeOf(lastMessage.createdAt)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  {lastMessage.senderId === myId && (lastMessage.isRead ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />)}
                  {!lastMessage.content && <Paperclip className="h-3 w-3 shrink-0 text-primary" />}
                  <p className={`truncate text-xs ${unreadCount > 0 ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{previewOf(lastMessage)}</p>
                </div>
                {unreadCount > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unreadCount}</span>}
              </div>
            </PersonRow>
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationList;
