import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Eye, 
  X, 
  Send,
  MoreVertical,
  Inbox,
  Clock,
  RefreshCw,
  InboxIcon,
  AlertCircle
} from 'lucide-react';
import { api } from '../../../api/axios';

const ContactMessages = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/contact-messages');
      setMessages(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load contact messages.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMarkResolved = async (id) => {
    setUpdatingId(id);
    try {
      await api.patch(`/contact-messages/${id}/status`, { status: 'Resolved' });
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, status: 'Resolved' } : m)
      );
      if (selectedMessage?.id === id) {
        setSelectedMessage(prev => ({ ...prev, status: 'Resolved' }));
      }
    } catch (err) {
      console.error('Failed to update message status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Computed stats from real data
  const today = new Date().toISOString().split('T')[0];
  const stats = [
    { label: 'TOTAL', value: messages.length, icon: Inbox, color: 'bg-primary/10 text-primary' },
    { label: 'UNREAD', value: messages.filter(m => m.status === 'Unread').length, icon: Mail, color: 'bg-blue-500/10 text-blue-600' },
    {
      label: 'RECEIVED TODAY',
      value: messages.filter(m => m.date?.startsWith(today)).length,
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-600'
    },
    { label: 'RESOLVED', value: messages.filter(m => m.status === 'Resolved').length, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600' },
  ];

  const filteredMessages = messages.filter(m => {
    const matchesTab = activeTab === 'All' || m.status === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      m.sender?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.content?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const statusColors = {
    Unread: 'bg-blue-500/10 text-blue-600',
    Read: 'bg-slate-500/10 text-slate-600',
    Resolved: 'bg-emerald-500/10 text-emerald-600',
    Archived: 'bg-slate-400/10 text-slate-500',
  };

  return (
    <div className="flex-1 p-6 space-y-6 bg-slate-50/30 dark:bg-background overflow-y-scroll">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">Messages submitted by users through the Contact Admin form.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by user, email or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 h-11 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
            />
          </div>
          <button
            onClick={fetchMessages}
            title="Refresh messages"
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Inbox Card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground">Inbox</span>
          </div>
          <div className="flex items-center bg-muted/30 p-1 rounded-lg">
            {['All', 'Unread'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab} {tab === 'All'
                  ? `(${messages.length})`
                  : `(${messages.filter(m => m.status === tab).length})`
                }
              </button>
            ))}
          </div>
        </div>

        {/* Message List */}
        <div className="divide-y divide-border">
          {isLoading ? (
            /* Loading skeleton */
            <div className="p-12 flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
              <div className="h-4 w-40 bg-muted rounded-lg animate-pulse" />
              <div className="h-3 w-56 bg-muted/60 rounded-lg animate-pulse" />
            </div>
          ) : error ? (
            /* Error state */
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertCircle className="w-7 h-7" />
              </div>
              <p className="font-bold text-foreground">Failed to Load Messages</p>
              <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
              <button
                onClick={fetchMessages}
                className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredMessages.length === 0 ? (
            /* Empty state */
            <div className="p-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary/40">
                <InboxIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-foreground text-base">
                  {activeTab === 'All' && !searchQuery
                    ? 'No Messages Yet'
                    : 'No Messages Found'
                  }
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {activeTab === 'All' && !searchQuery
                    ? 'When users submit a message through the Contact Admin form, it will appear here.'
                    : 'Try adjusting your search or filter to find what you\'re looking for.'
                  }
                </p>
              </div>
              {(activeTab !== 'All' || searchQuery) && (
                <button
                  onClick={() => { setActiveTab('All'); setSearchQuery(''); }}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            /* Real messages */
            filteredMessages.map((message) => (
              <div key={message.id} className="group p-6 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs border border-primary/20">
                    {message.initials}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{message.sender}</span>
                      <span className="text-xs text-muted-foreground">&lt;{message.email}&gt;</span>
                      {message.subject && (
                        <span className="text-xs text-muted-foreground/70 italic truncate max-w-[200px]">
                          — {message.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{message.content}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <Clock className="w-3 h-3" />
                      <span>{message.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusColors[message.status] || statusColors['Read']}`}>
                    {message.status}
                  </span>
                  <button
                    onClick={() => { setSelectedMessage(message); setReplyText(''); }}
                    title="View message"
                    className="p-2 rounded-lg hover:bg-card border border-transparent hover:border-border text-muted-foreground hover:text-primary transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-foreground">Message Details</h2>
              </div>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Sender Info */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                    {selectedMessage.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{selectedMessage.sender}</h3>
                    <p className="text-xs text-muted-foreground">{selectedMessage.email}</p>
                    {selectedMessage.subject && (
                      <p className="text-xs text-muted-foreground/70 italic mt-0.5">{selectedMessage.subject}</p>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusColors[selectedMessage.status] || statusColors['Read']}`}>
                    {selectedMessage.status}
                  </span>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">{selectedMessage.date}</p>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Message Content</h4>
                <div className="p-5 rounded-xl border border-border bg-card text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {selectedMessage.content}
                </div>
              </div>

              {/* Reply Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between ml-1">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reply Options</h4>
                  <div className="flex items-center gap-2">
                    <a
                      href={`mailto:${selectedMessage.email}`}
                      className="p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                      title="Reply via Email client"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                    <button className="p-2 rounded-lg bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 transition-colors" title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <textarea
                    placeholder="Type your reply here... (opens your email client)"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full h-32 p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm resize-none"
                  />
                  <div className="absolute bottom-3 right-3">
                    <a
                      href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject || 'Your inquiry')}&body=${encodeURIComponent(replyText)}`}
                      className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 flex items-center gap-2 transition-all"
                    >
                      <Send className="w-3 h-3" />
                      Reply via Email
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3">
              <button 
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-bold text-muted-foreground hover:bg-card transition-colors"
              >
                Close
              </button>
              <button 
                disabled={selectedMessage.status === 'Resolved' || updatingId === selectedMessage.id}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={async () => {
                  await handleMarkResolved(selectedMessage.id);
                  setSelectedMessage(null);
                }}
              >
                {updatingId === selectedMessage.id ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {selectedMessage.status === 'Resolved' ? 'Already Resolved' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMessages;
