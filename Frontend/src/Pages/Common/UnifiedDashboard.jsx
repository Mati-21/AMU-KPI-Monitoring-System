import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useState, useEffect } from 'react';
import { api } from '../../api/axios';

function UnifiedDashboard() {
  const [derivedKpiId, setDerivedKpiId] = useState('__ALL__');
  const [selectedRoleId, setSelectedRoleId] = useState('__ALL__');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedCycleYear, setSelectedCycleYear] = useState('');
  
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await api.get('/kpi-year-plans');
        const plans = res.data?.data || [];
        // Extract distinct years and sort descending
        const years = [...new Set(plans.map(p => p.CycleYear))].sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
        if (years.length > 0 && !selectedCycleYear) {
            setSelectedCycleYear(''); 
        }
      } catch (err) {
        console.error('Failed to load cycle years', err);
      }
    };
    fetchYears();
  }, []);

  const { config } = useDashboardData({ 
    derivedKpiId, 
    cycleYear: selectedCycleYear,
    focusedRoleId: selectedRoleId
  });

  if (config.isLoading) {
    return <div className="flex h-full items-center justify-center p-6 text-muted-foreground">Loading dashboard metrics...</div>;
  }

  if (config.loadError) {
    return <div className="flex h-full items-center justify-center p-6 text-red-500">Error: {config.loadError}</div>;
  }

  if (!config.hasData) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-semibold text-foreground">No Performance Data</h2>
        <p className="text-muted-foreground max-w-md">
          There are no KPI assignments or quarterly submissions recorded for your role or sub-units yet. Once data is submitted, your dashboard will
          populate with real-time analytics.
        </p>
      </div>
    );
  }

  return (
    <PerformanceDashboard 
      config={{...config, yearOptions: availableYears.length > 0 ? availableYears : ['Current Cycle']}} 
      derivedKpiId={derivedKpiId} 
      onDerivedKpiChange={setDerivedKpiId}
      focusedRoleId={selectedRoleId}
      onRoleChange={setSelectedRoleId}
      selectedCycleYear={selectedCycleYear}
      onYearChange={setSelectedCycleYear}
    />
  );
}

export default UnifiedDashboard;
