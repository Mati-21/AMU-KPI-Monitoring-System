import { Bell, Building2, Moon, Sun, Layers, User, Settings, LogOut, MessageSquare, X } from 'lucide-react';
import { formatEthiopianDateTime } from '../../lib/ethiopianDate';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import useTheme from '../../hooks/useTheme';

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/DropDown';
import { logout } from '../../../features/01-identity/store/authSlice';
import PersonAvatar from '../../../features/01-identity/components/PersonAvatar';
import { useCan } from '../../../features/03-access-control/hooks/useCan';
import { api } from '../../api/axios';
import { useMarkAllRead, useMarkRead, useNotificationList, useNotificationRealtime, useUnreadCount } from '../../../features/09-notifications/hooks/useNotifications';
import { notificationLink } from '../../../features/09-notifications/lib/notificationLink';
import { useMessagingRealtime, useUnreadMessagesCountQuery } from '../../../features/13-messaging/hooks/useMessaging';
import { getFileUrl } from '../../lib/utils';

const navLinks = ['About', 'Features', 'Benefits'];

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const can = useCan();

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
  // The office the person works in: their primary placement, or the first one
  const placement = user?.placements?.find((item) => item.isPrimary) ?? user?.placements?.[0];
  const otherOffices = Math.max(0, (user?.placements?.length ?? 0) - 1);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef(null);

  useNotificationRealtime();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: recent, isLoading: notificationLoading } = useNotificationList({ limit: 5, enabled: isAuthenticated && notificationOpen });
  const recentNotifications = recent?.items ?? [];
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const openNotification = (item) => {
    setNotificationOpen(false);
    if (!item.isRead) markRead.mutate(item.id);
    navigate(notificationLink(item) ?? '/alert-notification');
  };

  useMessagingRealtime();
  const { data: unreadMessagesCount = 0 } = useUnreadMessagesCountQuery();

  useEffect(() => {
    if (!notificationOpen) return undefined;
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="flex min-w-0 items-center gap-3">
        {placement && (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={placement.office?.name}>
                {placement.office?.name}
                {otherOffices > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">+{otherOffices} more</span>}
              </p>
              {placement.position?.title && <p className="truncate text-xs text-muted-foreground">{placement.position.title}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="p-2 rounded-lg hover:bg-muted" onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Light mode' : 'Dark mode'}>
          {isDark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
        </button>

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
            onClick={() => navigate('/direct-messages')}
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
            onClick={() => setNotificationOpen((prev) => !prev)}
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
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => markAllRead.mutate()}>
                      Mark all read
                    </button>
                  )}
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
              </div>

              <div className="max-h-96 overflow-auto">
                {notificationLoading ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">Loading...</div>
                ) : recentNotifications.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No notifications yet.</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {recentNotifications.map((item) => {
                      const title = item.title || 'Notification';
                      const message = item.message || '';
                      const createdAt = formatEthiopianDateTime(item.createdAt);
                      const isUnread = !item.isRead;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`w-full text-left px-3 py-2.5 rounded-md border border-border/60 hover:bg-muted ${isUnread ? 'bg-muted/30' : ''}`}
                          onClick={() => openNotification(item)}
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
              <PersonAvatar personId={user?.personId} fileId={user?.profilePictureFileId} fullName={displayName} className="w-9 h-9 text-xs" />
            </div>
          }
        >
          <DropdownMenuItem>
            <Link to={profilePath} className="flex items-center w-full">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </Link>
          </DropdownMenuItem>
          {can('settings:manage') && (
            <DropdownMenuItem>
              <Link to="/configuration" className="flex items-center w-full">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
          )}
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
