import { Home, Bell, Moon, Sun, Layers, User, Settings, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState } from 'react';
import useTheme from '../../Hooks/useTheme';

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../UI/DropDown';
import { logout } from '../../Features/authSlice';
import { api, BASE_URL } from '../../api/axios';

const navLinks = ['About', 'Features', 'Benefits', 'Contact'];

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const systemSettings = useSelector((state) => state.auth.systemSettings);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  const logoUrl = systemSettings?.systemLogo 
    ? `${BASE_URL}${systemSettings.systemLogo}` 
    : null;

  const location = useLocation();
  const profilePath = '/profile';
  const displayName = user?.name || user?.fullName || user?.FullName || 'Signed In';
  const displayRole = String(user?.role || user?.roleName || 'User').trim();
  const [showFullRole, setShowFullRole] = useState(false);

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
      // 1. Tell backend to clear the cookie
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Backend logout failed or was already cleared', err);
    } finally {
      // 2. Clear frontend state
      dispatch(logout());
      
      // 3. Clear all local storage to be safe
      localStorage.clear();
      
      // 4. Hard redirect to signin to flush all memory/cache
      window.location.href = '/signin';
    }
  };

  return isAuthenticated ? (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 w-full">
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-secondary">
          <Home className="w-5 h-5 text-muted-foreground" />
        </button>

        <button className="p-2 rounded-lg hover:bg-secondary" onClick={toggleTheme}>
          {isDark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-muted relative" onClick={() => navigate('/alerts')}>
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </button>
        <div className="h-8 w-px bg-border mx-1" />

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
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {displayName
                  ?.split(' ')
                  .map((segment) => segment[0])
                  .join('') || 'U'}
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
    <nav className="sticky top-0 z-50 bg-background border-b  border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 group-hover:border-primary/50 transition-colors">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Layers className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="font-extrabold text-foreground tracking-tight">
              {systemSettings?.displayName || 'AMU KPI System'}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {systemSettings?.orgName || 'ArbaMinch University'}
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => (
            <a key={link} href={`/#${link.toLowerCase()}`}>
              {link}
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
          <button className="h-10 border px-3 rounded cursor-pointer">Learn More</button>
          {location.pathname !== '/signin' && (
            <button className="h-10 bg-primary text-white px-3 rounded cursor-pointer" onClick={() => navigate('/signin')}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
