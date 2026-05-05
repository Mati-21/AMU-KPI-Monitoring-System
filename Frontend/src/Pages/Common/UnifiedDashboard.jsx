import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useState } from 'react';

function UnifiedDashboard() {
  const [derivedKpiId, setDerivedKpiId] = useState('__ALL__');
  const { config } = useDashboardData({ derivedKpiId });

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

  return <PerformanceDashboard config={config} derivedKpiId={derivedKpiId} onDerivedKpiChange={setDerivedKpiId} />;
}

export default UnifiedDashboard;
