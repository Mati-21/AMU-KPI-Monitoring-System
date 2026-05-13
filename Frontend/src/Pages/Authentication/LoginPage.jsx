import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import kpiImage from '../../assets/images/kpi.jpeg';
import Navbar from '../../Components/UI/Navbar';
import { Input } from '../../Components/UI/Input';
import { useLogin } from '../../Hooks/Auth/useLogin';
import { getDefaultRouteByRole } from '../../lib/authRouting';
import { api, BASE_URL } from '../../api/axios';
import { useSelector } from 'react-redux';
import { getFileUrl } from '../../lib/utils';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const navigate = useNavigate();

  const systemSettings = useSelector((state) => state.auth.systemSettings);
  const logoUrl = getFileUrl(systemSettings?.systemLogo);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/settings/status');
        setIsMaintenance(res.data.maintenanceMode);
      } catch (err) {
        console.error("Failed to check system status", err);
      }
    };
    checkStatus();
  }, []);

  // Use the custom hook
  const { mutate: loginMutate, isPending, error } = useLogin();

  const handleSubmit = (e) => {
    e.preventDefault();

    // Call the custom hook's mutate function
    loginMutate(
      { UserName: email, password },
      {
        onSuccess: (data) => {
          const role = data?.role?.RoleName || data?.user?.role || data?.user?.RoleName || data?.user?.Role || '';
          const permissions = data?.role?.Permissions || data?.user?.permissions || data?.user?.Permissions || [];
          navigate(getDefaultRouteByRole(role, permissions));
        },
      }
    );
  };

  return (
    <div className="flex-1 bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-6 py-8 relative">
        <div className="absolute inset-0 opacity-[0.08] bg-white z-0" style={{ backgroundImage: `url(${kpiImage})` }} />

        <div className="w-full max-w-md animate-fade-in-up relative z-50">
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl shadow-primary/5 p-8 sm:p-10 space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 p-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="System Logo" className="w-full h-full object-contain" />
                ) : (
                  <Mail className="w-8 h-8 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">
                  {systemSettings?.orgName || 'ArbaMinch University'}
                </h2>
                <h1 className="text-lg font-black text-foreground tracking-tight mt-1">
                  {systemSettings?.displayName || 'KPI Monitoring System'}
                </h1>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 text-center">
              <h3 className="text-xl font-bold text-foreground tracking-tight">Sign In</h3>
            </div>

            {isMaintenance && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider text-center w-full">
                  System Maintenance Active: Administrative Access Only
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground/70 ml-1">
                  Username or Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="text"
                    placeholder="you@amu.edu.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 w-full rounded-md border border-input bg-background text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground/70 ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 w-full text-base"
                    required
                  />
                </div>
              </div>



              {error ? (
                <p className="text-sm text-red-500">{error.response?.data?.message || error.message || 'Login failed. Please try again.'}</p>
              ) : null}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 gap-2 text-sm font-medium rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Signing In...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/contact-admin" className="text-primary font-medium hover:underline underline-offset-4">
              Contact your administrator
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
