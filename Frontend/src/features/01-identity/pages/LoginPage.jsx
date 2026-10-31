import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useSelector } from 'react-redux';

import kpiImage from '../../../assets/images/kpi.jpeg';
import Navbar from '../../../shared/components/layout/Navbar';
import { getFileUrl } from '../../../shared/lib/utils';
import { ChangePasswordStep, MfaCodeStep, MfaSetupStep, PasswordStep } from '../components/login/LoginSteps';
import { useLogin } from '../hooks/useLogin';

const SignIn = () => {
  const systemSettings = useSelector((state) => state.auth.systemSettings);
  const isMaintenance = useSelector((state) => state.auth.isMaintenance);
  const logoUrl = getFileUrl(systemSettings?.systemLogo);
  const { step, restart, signIn, changePassword, verifySetupCode, verifyCode } = useLogin();

  return (
    <div className="flex-1 bg-background flex flex-col overflow-y-auto w-full min-h-screen">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-6 py-8 relative">
        <div className="absolute inset-0 opacity-[0.08] bg-white z-0" style={{ backgroundImage: `url(${kpiImage})` }} />

        <div className="w-full max-w-md animate-fade-in-up relative z-50">
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl shadow-primary/5 p-8 sm:p-10 space-y-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                {logoUrl ? <img src={logoUrl} alt="System Logo" className="w-full h-full object-contain" /> : <Mail className="w-8 h-8 text-primary" />}
              </div>
              <div>
                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">{systemSettings?.orgName || 'ArbaMinch University'}</h2>
                <h1 className="text-lg font-black text-foreground tracking-tight mt-1">{systemSettings?.displayName || 'KPI Monitoring System'}</h1>
              </div>
            </div>

            {isMaintenance && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider text-center w-full">System Maintenance Active: Administrative Access Only</p>
              </div>
            )}

            <div className="pt-2 border-t border-border/50">
              {step === 'password' && <PasswordStep mutation={signIn} />}
              {step === 'change-password' && <ChangePasswordStep mutation={changePassword} onBack={restart} />}
              {step === 'mfa-setup' && <MfaSetupStep mutation={verifySetupCode} onBack={restart} />}
              {step === 'mfa-code' && <MfaCodeStep mutation={verifyCode} onBack={restart} />}
            </div>
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
