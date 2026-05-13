import { useState, useEffect, useMemo } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';
import { useKpiYearPlansQuery } from '../../Hooks/Queries/useKpis';

function UnifiedDashboard() {
  const [derivedKpiId, setDerivedKpiId] = useState('__ALL__');
  const [selectedRoleId, setSelectedRoleId] = useState('__ALL__');
  const [selectedCycleYear, setSelectedCycleYear] = useState('');

  // Queries
  const { data: yearPlans = [] } = useKpiYearPlansQuery();

  const availableYears = useMemo(() => {
    return [...new Set(yearPlans.map((p) => p.CycleYear))].sort((a, b) => b.localeCompare(a));
  }, [yearPlans]);

  const { config } = useDashboardData({
    derivedKpiId,
    cycleYear: selectedCycleYear,
    focusedRoleId: selectedRoleId,
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
      config={{ ...config, yearOptions: availableYears.length > 0 ? availableYears : ['Current Cycle'] }}
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
