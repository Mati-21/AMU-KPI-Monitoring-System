import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, CheckCheck, Calendar, Search, Filter, Check, ChevronDown } from 'lucide-react';
import { Badge } from '../../../Components/UI/Badge';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';
import { useSocket } from '../../../Context/SocketContext';

/* -------------------- Custom Select -------------------- */
const CustomSelect = ({ options = [], value, onChange, placeholder = 'Select...', className = '' }) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 h-9 text-xs text-left bg-card border border-border rounded-md flex justify-between items-center"
      >
        {selectedLabel}
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <ul className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-md max-h-60 overflow-auto">
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-xs hover:bg-accent/30 flex justify-between items-center"
            >
              {opt.label}
              {value === opt.value && <Check className="w-4 h-4 text-primary" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* -------------------- Simple Button -------------------- */
const Button = ({ children, className = '', ...props }) => {
  return (
    <button className={`px-3 py-2 rounded-md text-sm font-medium ${className}`} {...props}>
      {children}
    </button>
  );
};

/* -------------------- Simple Input -------------------- */
const Input = ({ className = '', ...props }) => {
  return <input className={`border border-border rounded-md px-3 py-2 text-sm ${className}`} {...props} />;
};

/* -------------------- Helpers -------------------- */
const formatDateLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};



/* -------------------- Main Component -------------------- */
const AlertsNotifications = () => {
  const { notify } = useNotification();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [priority, setPriority] = useState('all');
  const [date, setDate] = useState('all');
  const [type, setType] = useState('7days');
  const [sortBy, setSortBy] = useState('newest');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/my', { params: { limit: 200 } });
      const rows = response?.data?.data || [];

      setNotifications(
        rows.map((row) => ({
          id: row.Id,
          title: row.Title || 'Notification',
          description: row.Message || '',
          date: formatDateLabel(row.CreatedAt),
          createdAt: row.CreatedAt,
          read: Boolean(row.IsRead),
          type: row.Type || null,
          data: row.Data || null,
        }))
      );
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to load notifications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('notifications:new', (row) => {
      if (!row?.Id) return;

      setNotifications((prev) => {
        const exists = Array.isArray(prev) && prev.some((n) => String(n.id) === String(row.Id));
        if (exists) return prev;

        const next = {
          id: row.Id,
          title: row.Title || 'Notification',
          description: row.Message || '',
          date: formatDateLabel(row.CreatedAt),
          createdAt: row.CreatedAt,
          read: Boolean(row.IsRead),
          type: row.Type || null,
          data: row.Data || null,
        };

        return [next, ...(Array.isArray(prev) ? prev : [])];
      });
    });

    return () => {
      socket.off('notifications:new');
    };
  }, [socket]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/my/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to mark all as read.', 'error');
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to mark notification as read.', 'error');
    }
  };

  const now = useMemo(() => new Date(), []);

  const passesDateFilter = (createdAt) => {
    if (!createdAt) return true;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return true;

    if (date === 'today') {
      return created.toDateString() === now.toDateString();
    }

    if (date === 'week') {
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }

    if (date === 'month') {
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }

    return true;
  };

  const passesTypeFilter = (createdAt) => {
    if (type === 'all') return true;
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return true;
    const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (type === '7days') return diffDays >= 0 && diffDays <= 7;
    if (type === '30days') return diffDays >= 0 && diffDays <= 30;
    return true;
  };

  const filtered = notifications.filter((n) => {
    const query = String(search || '')
      .trim()
      .toLowerCase();
    const title = String(n.title || '');
    const description = String(n.description || '');
    const priorityText = String(n.priority || '');
    const typeText = String(n.type || '');
    const matchesSearch =
      !query ||
      title.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      typeText.toLowerCase().includes(query);

    const matchesDate = passesDateFilter(n.createdAt);
    const matchesType = passesTypeFilter(n.createdAt);

    return matchesSearch && matchesDate && matchesType;
  });

  const sorted = useMemo(() => {
    const rows = [...filtered];

    if (sortBy === 'unread') {
      rows.sort((a, b) => {
        const leftUnread = a.read ? 0 : 1;
        const rightUnread = b.read ? 0 : 1;
        if (leftUnread !== rightUnread) return rightUnread - leftUnread;
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      return rows;
    }

    // newest (default)
    rows.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    return rows;
  }, [filtered, sortBy]);

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Alert & Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Monitor and manage notifications</p>
          </div>

          <div className="flex gap-3">
            <Button className="border flex items-center gap-2" onClick={fetchNotifications} disabled={loading}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>

            <Button onClick={markAllRead} className="bg-blue-600 text-white flex items-center gap-2">
              <CheckCheck className="w-4 h-4" /> Mark All
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">


          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs">Date :</span>

            <CustomSelect
              value={date}
              onChange={setDate}
              className="w-36"
              options={[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
              ]}
            />
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-xs">Type :</span>

            <CustomSelect
              value={type}
              onChange={setType}
              className="w-36"
              options={[
                { label: 'Last 7 Days', value: '7days' },
                { label: 'Last 30 Days', value: '30days' },
                { label: 'All Time', value: 'all' },
              ]}
            />
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search" className="pl-9 h-10 w-64 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {sorted.map((n) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              className={`flex justify-between rounded-md bg-card shadow-sm border border-border border-l-4 border-l-primary/30 px-4 py-3 cursor-pointer hover:bg-accent/20 ${
                n.read ? 'opacity-80' : ''
              }`}
              onClick={() => {
                if (!n.read) {
                  markOneRead(n.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !n.read) {
                  markOneRead(n.id);
                }
              }}
            >
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{n.title}</h3>
                <p className="text-xs text-gray-500">{n.description}</p>

                <div className="flex gap-3 mt-2">
                  <span className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {n.date}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AlertsNotifications;
