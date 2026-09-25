import { Home, Bell, Moon, Sun, Layers, User, Settings, LogOut, MessageSquare, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import useTheme from '../../Hooks/useTheme';

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../UI/DropDown';
import { logout } from '../../Features/authSlice';
import { api } from '../../api/axios';
import { useNotification } from '../../Context/NotificationContext';
import { useSocket } from '../../Context/SocketContext';
import { getFileUrl } from '../../lib/utils';

const navLinks = ['About', 'Features', 'Benefits'];

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();

  const { notify } = useNotification();

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const systemSettings = useSelector((state) => state.auth.systemSettings);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const logoUrl = getFileUrl(systemSettings?.systemLogo);

  const location = useLocation();
  const profilePath = '/profile';
  const displayName = user?.name || user?.fullName || user?.FullName || 'Signed In';
  const displayRole = String(user?.role || user?.roleName || 'User').trim();
  const [showFullRole, setShowFullRole] = useState(false);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const notificationOpenRef = useRef(false);
  const prevUnreadCountRef = useRef(null);
  const skipSoundOnFirstLoadRef = useRef(true);
  const audioContextRef = useRef(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const audioUnlockedRef = useRef(false);

  const formatDateLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/notifications/my/unread-count');
      const count = Number(res?.data?.data?.unread || 0);
      setUnreadCount(Number.isFinite(count) ? count : 0);
    } catch {
      // Silent: don't spam users for a non-critical badge update.
    }
  };

  const fetchUnreadMessagesCount = async () => {
    try {
      const res = await api.get('/messages/unread-count');
      setUnreadMessagesCount(res?.data?.data?.unread || 0);
    } catch {
      // Silent
    }
  };

  const playNotificationSound = async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        audioContextRef.current = new AudioContextCtor();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      master.connect(ctx.destination);

      const tones = [523.25, 659.25];
      tones.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now + index * 0.02);
        gain.gain.exponentialRampToValueAtTime(1.0, now + index * 0.02 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.02 + 0.12);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now + index * 0.02);
        osc.stop(now + index * 0.02 + 0.14);
      });
    } catch {
      // Browser may block autoplay audio; ignore quietly.
    }
  };

  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const fetchRecentNotifications = async () => {
    try {
      setNotificationLoading(true);
      const res = await api.get('/notifications/my', { params: { limit: 5, offset: 0 } });
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setRecentNotifications(rows);
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to load notifications.', 'error');
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();
    fetchUnreadMessagesCount();
    // keep badge reasonably fresh
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchUnreadMessagesCount();
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('notifications:new', (payload) => {
      try {
        if (!notificationOpenRef.current) {
          playNotificationSound();
        }

        setUnreadCount((prev) => {
          const next = Number(prev || 0) + 1;
          prevUnreadCountRef.current = next;
          return next;
        });

        setRecentNotifications((prev) => {
          const nextItem = payload;
          const merged = [nextItem, ...(Array.isArray(prev) ? prev : [])]
            .filter(Boolean)
            .filter((item, index, arr) => arr.findIndex((x) => String(x?.Id) === String(item?.Id)) === index)
            .slice(0, 5);
          return merged;
        });
      } catch {
        // ignore
      }
    });

    socket.on('messages:new', () => {
      if (window.location.pathname !== '/direct-messages') {
        playNotificationSound();
        setUnreadMessagesCount(prev => prev + 1);
      }
    });

    return () => {
      socket.off('notifications:new');
      socket.off('messages:new');
    };
  }, [socket]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const previous = prevUnreadCountRef.current;
    prevUnreadCountRef.current = unreadCount;

    if (skipSoundOnFirstLoadRef.current) {
      skipSoundOnFirstLoadRef.current = false;
      return;
    }

    if (!notificationOpenRef.current && previous !== null && Number(unreadCount) > Number(previous)) {
      playNotificationSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, isAuthenticated]);

  const markAllReadFromBell = async () => {
    if (unreadCount <= 0) return;

    // Optimistic UI: clear badge immediately on click.
    setUnreadCount(0);
    setRecentNotifications((prev) => prev.map((n) => ({ ...n, IsRead: true })));

    try {
      await api.patch('/notifications/my/read-all');
    } catch (error) {
      // restore true unread count from server
      fetchUnreadCount();
      notify(error?.response?.data?.message || 'Failed to mark notifications as read.', 'error');
    }
  };

  useEffect(() => {
    if (!notificationOpen) return;
    fetchRecentNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationOpen]);

  useEffect(() => {
    if (!notificationOpen) return;

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationOpen]);

  useEffect(() => {
    notificationOpenRef.current = notificationOpen;
  }, [notificationOpen]);

  const rolePreview = useMemo(() => {
    const words = displayRole.split(/\s+/).filter(Boolean);
    if (words.length <= 3) {
      return { text: displayRole, hasHiddenPart: false };
    }

    return {
      text: `${words.slice(0, 3).join(' ')}`,
      hasHiddenPart: true,
    };
  }, [displayRole]);

  const handleLogout = async () => {
    try {
      // 1. Backend logout to clear httpOnly cookie
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }

    // 2. Clear frontend state immediately
    dispatch(logout());

    // 3. Optional: Clear specific non-theme items if needed
    // localStorage.removeItem('some-other-key');

    // 4. Seamless SPA redirect to sign-in page
    navigate('/signin');
  };

  const isLandingPage = location.pathname === '/';

  return (isAuthenticated && !isLandingPage) ? (
    <header className="h-16 bg-[var(--navbar-background)] border-b border-[var(--navbar-border)] flex items-center justify-between px-6 w-full">
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-muted">
          <Home className="w-5 h-5 text-muted-foreground" />
        </button>

        <button className="p-2 rounded-lg hover:bg-muted" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {location.pathname === '/direct-messages' ? (
          <button
            type="button"
            className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all font-bold flex items-center gap-2 text-xs"
            onClick={() => navigate('/dashboard')}
            aria-label="Exit Direct Messages"
          >
            <X className="w-5 h-5" />
            EXIT CHAT
          </button>
        ) : (
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-muted relative"
            onClick={() => {
              setUnreadMessagesCount(0);
              navigate('/direct-messages');
            }}
            aria-label="Direct Messages"
          >
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </button>
        )}

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-muted relative"
            onClick={() => {
              setNotificationOpen((prev) => {
                const next = !prev;
                if (next) {
                  markAllReadFromBell();
                }
                return next;
              });
            }}
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notificationOpen}
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {notificationOpen ? (
            <div className="absolute right-0 mt-2 w-80 rounded-md bg-card shadow-md z-50 border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Notifications</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => {
                    setNotificationOpen(false);
                    navigate('/alert-notification');
                  }}
                >
                  View all
                </button>
              </div>

              <div className="max-h-96 overflow-auto">
                {notificationLoading ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">Loading...</div>
                ) : recentNotifications.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No notifications yet.</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {recentNotifications.map((item) => {
                      const title = item?.Title || 'Notification';
                      const message = item?.Message || '';
                      const createdAt = formatDateLabel(item?.CreatedAt);
                      const isUnread = !item?.IsRead;

                      return (
                        <button
                          type="button"
                          key={item.Id}
                          className={`w-full text-left px-3 py-2.5 rounded-md border border-border/60 hover:bg-muted ${isUnread ? 'bg-muted/30' : ''}`}
                          onClick={() => {
                            setNotificationOpen(false);
                            navigate('/alert-notification');
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{message}</p>
                            </div>
                            <div className="shrink-0 text-[10px] text-muted-foreground">{createdAt}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="h-8 w-px bg-[var(--navbar-border)] mx-1" />

        <DropdownMenu
          trigger={
            <div role="button" tabIndex={0} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted">
              <div className="text-right">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {showFullRole || !rolePreview.hasHiddenPart ? displayRole : rolePreview.text}
                  {rolePreview.hasHiddenPart ? (
                    <button
                      type="button"
                      className="ml-1 font-semibold text-primary hover:underline"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowFullRole((previous) => !previous);
                      }}
                      aria-label={showFullRole ? 'Show shortened role name' : 'Show full role name'}
                    >
                      {showFullRole ? 'show less' : '...'}
                    </button>
                  ) : null}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden">
                {user?.ProfilePicture ? (
                  <img src={getFileUrl(user.ProfilePicture)} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  displayName
                    ?.split(' ')
                    .map((segment) => segment[0])
                    .join('') || 'U'
                )}
              </div>
            </div>
          }
        >
          <DropdownMenuItem>
            <Link to={profilePath} className="flex items-center w-full">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link to="/configuration" className="flex items-center w-full">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-500 flex">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  ) : (
    <nav className="sticky top-0 z-50 bg-[var(--navbar-background)] border-b border-[var(--navbar-border)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 group-hover:border-primary/50 transition-colors">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /> : <Layers className="w-6 h-6 text-primary" />}
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="font-extrabold text-foreground tracking-tight">{systemSettings?.displayName || 'AMU KPI System'}</span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {systemSettings?.orgName || 'ArbaMinch University'}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`/#${link.toLowerCase()}`}
              className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-all duration-300 relative group"
            >
              {link}
              <span className="absolute bottom-1 left-4 right-4 h-0.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="h-10 w-10 rounded border border-border hover:bg-secondary flex items-center justify-center"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            className="h-10 px-4 rounded-md border border-border bg-background text-sm font-semibold hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200"
          >
            Learn More
          </button>
          {location.pathname !== '/signin' && (
            <button
              className="h-10 bg-primary text-primary-foreground px-5 rounded-md text-sm font-semibold hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200"
              onClick={() => navigate('/signin')}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
