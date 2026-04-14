import { Home, Bell, Moon, Sun, Layers, User, Settings, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import useTheme from '../../Hooks/useTheme';

import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../UI/DropDown';
import { logout } from '../../Features/authSlice';

const navLinks = ['About', 'Features', 'Benefits', 'Contact'];

const Navbar = () => {
  const { isDark, toggleTheme } = useTheme();

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = Boolean(user);
  const location = useLocation();

  const layoutBasePath = [
    '/admin',
    '/staff',
    '/department-chair',
    '/faculty-admin',
    '/higher-institution',
    '/vice-president',
    '/strategic-office',
  ].find((basePath) => location.pathname.startsWith(basePath));

  const profilePath = layoutBasePath ? `${layoutBasePath}/profile` : '/admin/profile';
  const displayName = user?.name || user?.fullName || user?.FullName || 'Signed In';
  const displayRole = user?.role || user?.roleName || 'User';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/signin');
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
            <button className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted">
              <div className="text-right">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayRole}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {displayName
                  ?.split(' ')
                  .map((segment) => segment[0])
                  .join('') || 'U'}
              </div>
            </button>
          }
        >
          <DropdownMenuItem>
            <Link to={profilePath} className="flex items-center w-full">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link to="configuration" className="flex items-center w-full">
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
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold">AMU KPI System</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => (
            <a key={link} href={`/#${link.toLowerCase()}`}>
              {link}
            </a>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="border px-3 py-2 rounded cursor-pointer">Learn More</button>
          {location.pathname !== '/signin' && (
            <button className="bg-primary text-white px-3 py-2 rounded cursor-pointer" onClick={() => navigate('/signin')}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
