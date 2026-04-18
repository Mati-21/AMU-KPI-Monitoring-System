import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import kpiImage from '../../assets/images/kpi.jpeg';
import Navbar from '../../Components/UI/Navbar';
import { Input } from '../../Components/UI/Input';
import { useLogin } from '../../Hooks/Auth/useLogin';
import { getDefaultRouteByRole } from '../../lib/authRouting';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();

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
      <div className="flex-1 flex items-center justify-center px-6 py-16 relative">
        <div className="absolute inset-0 opacity-[0.08] bg-white z-0" style={{ backgroundImage: `url(${kpiImage})` }} />

        <div className="w-full max-w-md animate-fade-in-up relative z-50">
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl shadow-primary/5 p-8 sm:p-10 space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Sign In</h1>
              <p className="text-sm text-muted-foreground">Access your KPI management dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
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
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
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

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded-sm border border-primary focus:ring-2 focus:ring-ring"
                  />
                  <label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">
                    Remember Me
                  </label>
                </div>
                <a href="#" className="text-sm text-primary hover:underline underline-offset-4">
                  Forgot password?
                </a>
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
            <a href="#" className="text-primary font-medium hover:underline underline-offset-4">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
