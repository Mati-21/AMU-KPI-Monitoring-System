import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatEthiopianDateTime } from '../../../shared/lib/ethiopianDate';
import { useMarkAllRead, useMarkRead, useNotificationList, useUnreadCount } from '../hooks/useNotifications';
import { notificationLink } from '../lib/notificationLink';

const PAGE_SIZE = 20;
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

const AlertsNotifications = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const unreadOnly = tab === 'unread';
  const { data, isLoading, isFetching, error, refetch } = useNotificationList({ page, limit: PAGE_SIZE, unreadOnly });
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = data?.items ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total = data?.pagination?.total ?? 0;
  const actionError = markRead.error || markAllRead.error;

  const changeTab = (value) => {
    setTab(value);
    setPage(1);
  };

  const open = (item) => {
    if (!item.isRead) markRead.mutate(item.id);
    const link = notificationLink(item);
    if (link) navigate(link);
  };

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <main className="flex-1 min-w-0 space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alerts & Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={() => markAllRead.mutate()} disabled={unreadCount === 0 || markAllRead.isPending}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {TABS.map(({ value, label }) => (
            <Button key={value} size="sm" variant={tab === value ? 'default' : 'outline'} onClick={() => changeTab(value)}>
              {label}
              {value === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Button>
          ))}
        </div>

        {(error || actionError) && <p className="text-sm text-red-500">{apiErrorMessage(error || actionError, 'Could not load notifications.')}</p>}

        <div className="space-y-3">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => open(item)}
                className={`flex w-full items-start gap-3 rounded-md border border-l-4 border-border bg-card px-4 py-3 text-left shadow-sm hover:bg-accent/20 ${item.isRead ? 'border-l-transparent opacity-80' : 'border-l-primary'}`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className={`text-sm ${item.isRead ? 'font-medium' : 'font-semibold'}`}>{item.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {formatEthiopianDateTime(item.createdAt)}
                  </p>
                </div>
                {!item.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </button>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} notifications
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AlertsNotifications;
