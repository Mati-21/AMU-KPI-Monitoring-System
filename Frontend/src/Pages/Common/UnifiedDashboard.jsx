import { useState, useEffect } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';
import { useCycleYearsQuery } from '../../Hooks/Queries/useKpis';

function UnifiedDashboard() {
  const [derivedKpiId, setDerivedKpiId] = useState('__ALL__');
  const [selectedRoleId, setSelectedRoleId] = useState('__ALL__');
  const [selectedCycleYear, setSelectedCycleYear] = useState('');

  // Queries
  const { data: cycleYearsData } = useCycleYearsQuery();
  const activeCycleYearFromServer = cycleYearsData?.activeCycleYear || '';
  const availableYears = Array.isArray(cycleYearsData?.years) ? cycleYearsData.years : [];

  useEffect(() => {
    if (!selectedCycleYear && activeCycleYearFromServer) {
      setSelectedCycleYear(activeCycleYearFromServer);
    }
  }, [activeCycleYearFromServer, selectedCycleYear]);

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

  return (
    <PerformanceDashboard
      config={{ ...config, yearOptions: availableYears.length > 0 ? availableYears : activeCycleYearFromServer ? [activeCycleYearFromServer] : [] }}
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
