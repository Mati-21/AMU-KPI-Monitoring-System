import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../../../api/axios';
import { useNotification } from '../../../Context/NotificationContext';
import Button from '../../../Components/UI/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../Components/UI/Card';

const CycleManagement = () => {
  const authUser = useSelector((state) => state.auth?.user);
  const { notify } = useNotification();
  const [closing, setClosing] = useState(false);
  const [currentCycle, setCurrentCycle] = useState('Loading...');

  const isRootRole = authUser && authUser.currentRole && !authUser.currentRole.ParentRoleId;

  useEffect(() => {
    let mounted = true;
    const fetchCurrentCycle = async () => {
      try {
        const res = await api.get('/kpi-year-plans/cycle-years');
        if (!mounted) return;
        const payload = res.data?.data || {};
        setCurrentCycle(payload.activeCycleYear || 'Unknown');
      } catch (error) {
        console.error('Failed to load cycle plans', error);
      }
    };
    fetchCurrentCycle();
    return () => {
      mounted = false;
    };
  }, [closing]);

  if (!isRootRole) return null;

  const handleCloseYear = async () => {
    if (
      !window.confirm(
        `Are you sure you want to close the ${currentCycle} cycle year? This will calculate final performance and generate the baseline for the next year.`
      )
    ) {
      return;
    }

    setClosing(true);
    try {
      await api.post('/kpi-year-plans/close-year');
      notify('Cycle year successfully closed and next cycle initiated!', 'success');
      setClosing(false);
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to close cycle year', 'error');
      setClosing(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-xl font-bold">System Cycle Management</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Manage the organizational performance evaluation cycles.</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center justify-between bg-muted/30 p-6 rounded-xl border border-border gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Close Current Year ({currentCycle})</h3>
            <p className="text-sm text-muted-foreground max-w-xl mt-2">
              Closing the year will lock all KPI results for the current year and automatically set up the permanent KPI baselines and targets for the
              next year based on their lifecycle type (Recurring, Progressive, or One-Time).
            </p>
          </div>
          <Button onClick={handleCloseYear} disabled={closing} className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white font-medium">
            {closing ? 'Processing...' : 'Close Year & Start Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CycleManagement;
