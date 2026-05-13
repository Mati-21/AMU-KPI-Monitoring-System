import React, { useState } from 'react';
import { 
  Mail, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  Archive, 
  Eye, 
  X, 
  Send,
  MoreVertical,
  Filter,
  Inbox,
  Clock,
  User
} from 'lucide-react';
import { Badge } from '../../../Components/UI/Badge';

const ContactMessages = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Mock data matching the image
  const messages = [
    {
      id: 1,
      sender: 'abebe.kebede',
      email: 'abebe.kebede@aau.edu.et',
      subject: 'Access Issue',
      content: 'I cannot access the KPI assignment page for my department. It keeps redirecting me to the dashboard. Could you check my permissions?',
      date: '2026-05-12 09:42',
      status: 'Unread',
      initials: 'AK'
    },
    {
      id: 2,
      sender: 'sara.alemu',
      email: 'sara.alemu@aau.edu.et',
      subject: 'Feature Request',
      content: 'Please add a way to bulk import KPI evidence files. Uploading them one by one each quarter is very time consuming for our team.',
      date: '2026-05-11 16:18',
      status: 'Unread',
      initials: 'SA'
    },
    {
      id: 3,
      sender: 'daniel.tesfaye',
      email: 'daniel.tesfaye@aau.edu.et',
      subject: 'Data Error',
      content: 'The Q1 report is showing an incorrect aggregated value for Theme II. The chair confirmed the submitted data is correct.',
      date: '2026-05-10 11:05',
      status: 'Read',
      initials: 'DT'
    },
    {
      id: 4,
      sender: 'hanna.girma',
      email: 'hanna.girma@aau.edu.et',
      subject: 'Success Story',
      content: 'Thank you for the quick fix on the approval workflow — everything is working as expected now.',
      date: '2026-05-08 14:30',
      status: 'Resolved',
      initials: 'HG'
    },
    {
      id: 5,
      sender: 'yonas.mulu',
      email: 'yonas.mulu@aau.edu.et',
      subject: 'Archive Request',
      content: 'Old request — please archive this thread.',
      date: '2026-05-08 14:30',
      status: 'Archived',
      initials: 'YM'
    }
  ];

  const stats = [
    { label: 'TOTAL', value: 5, icon: Inbox, color: 'bg-primary/10 text-primary' },
    { label: 'UNREAD', value: 2, icon: Mail, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'RECEIVED TODAY', value: 1, icon: Clock, color: 'bg-amber-500/10 text-amber-600' },
    { label: 'AVG. RESPONSE', value: '2.4h', icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600' }
  ];

  const filteredMessages = messages.filter(m => {
    const matchesTab = activeTab === 'All' || m.status === activeTab;
    const matchesSearch = m.sender.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex-1 p-6 space-y-6 bg-slate-50/30 dark:bg-background overflow-y-scroll">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">Messages submitted by users through the Contact Admin form.</p>
        </div>
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
                {tab} {tab === 'All' ? `(${messages.length})` : `(${messages.filter(m => m.status === tab).length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Message List */}
        <div className="divide-y divide-border">
          {filteredMessages.length > 0 ? (
            filteredMessages.map((message) => (
              <div key={message.id} className="group p-6 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-xs border border-primary/20">
                    {message.initials}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{message.sender}</span>
                      <span className="text-xs text-muted-foreground">&lt;{message.email}&gt;</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{message.content}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <Clock className="w-3 h-3" />
                      <span>{message.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    message.status === 'Unread' ? 'bg-blue-500/10 text-blue-600' :
                    message.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-600' :
                    'bg-slate-500/10 text-slate-600'
                  }`}>
                    {message.status}
                  </span>
                  <button 
                    onClick={() => setSelectedMessage(message)}
                    className="p-2 rounded-lg hover:bg-card border border-transparent hover:border-border text-muted-foreground hover:text-primary transition-all shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No messages found.
            </div>
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
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                    {selectedMessage.status}
                  </span>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">{selectedMessage.date}</p>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Message Content</h4>
                <div className="p-5 rounded-xl border border-border bg-card text-sm leading-relaxed text-foreground/90">
                  {selectedMessage.content}
                </div>
              </div>

              {/* Reply Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between ml-1">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reply Options</h4>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title="Send via Email">
                      <Mail className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="relative group">
                  <textarea
                    placeholder="Type your direct message here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full h-32 p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm resize-none"
                  />
                  <div className="absolute bottom-3 right-3">
                    <button 
                      className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 flex items-center gap-2 transition-all"
                      onClick={() => {
                        alert('Direct message functionality coming soon!');
                        setReplyText('');
                      }}
                    >
                      <Send className="w-3 h-3" />
                      Send Direct
                    </button>
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
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors flex items-center gap-2"
                onClick={() => {
                  alert('Message marked as resolved');
                  setSelectedMessage(null);
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMessages;
