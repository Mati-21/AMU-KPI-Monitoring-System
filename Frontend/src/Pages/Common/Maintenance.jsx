import { Hammer, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../../api/axios';
import { setMaintenance } from '../../Features/authSlice';

const Maintenance = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkStatus();
    // Faster polling for better UX
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await api.get('/settings/status');
      if (!res.data.maintenanceMode) {
        dispatch(setMaintenance(false));
        navigate('/signin', { replace: true });
      }
    } catch (err) {
      console.error("Maintenance check failed", err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center p-6 animate-fade-in overflow-hidden">
      <div className="max-w-2xl w-full flex flex-col items-center text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="relative bg-card border border-border w-32 h-32 rounded-full flex items-center justify-center shadow-2xl">
          <Hammer className="w-16 h-16 text-primary animate-bounce" />
        </div>
      </div>

      <h1 className="text-4xl font-extrabold text-foreground mb-4 tracking-tight">
        System Under Maintenance
      </h1>
      
      <p className="text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
        We're currently performing some scheduled updates to improve your experience. 
        We'll be back online shortly!
      </p>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 mb-10 max-w-sm">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-600 font-medium text-left">
          All user actions are temporarily disabled to ensure data integrity during the update.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={checkStatus}
          disabled={checking}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
        >
          {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          {checking ? "Checking..." : "Check Status"}
        </button>
        <button 
          onClick={() => navigate('/login')}
          className="px-8 py-3 border border-border text-foreground rounded-full font-bold hover:bg-muted transition-all active:scale-95"
        >
          Back to Login
        </button>
      </div>

      <div className="mt-16 text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-50">
        ArbaMinch University KPI Monitoring System
      </div>
      </div>
    </div>
  );
};

export default Maintenance;
