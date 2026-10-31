import { useRef, useState } from 'react';
import { exportElementToPdf } from '../../../shared/lib/exportPdf';
import { useNotification } from '../../09-notifications/context/NotificationContext';

import DashboardHeader from './performance/DashboardHeader';
import OverallPerformance from './performance/OverallPerformance';
import PerformanceComparison from './performance/PerformanceComparison';
import PerformanceCharts from './performance/PerformanceCharts';
import DistributionAndHeatmap from './performance/DistributionAndHeatmap';
import PerformersAndGaps from './performance/PerformersAndGaps';
import DashboardFooter from './performance/DashboardFooter';

const PerformanceDashboard = ({
  config,
  derivedKpiId = '__ALL__',
  onDerivedKpiChange,
  focusedRoleId = '__ALL__',
  onRoleChange,
  selectedCycleYear,
  onYearChange,
}) => {
  const [quarter, setQuarter] = useState('All Quarters');
  const dashboardRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { notify } = useNotification();

  const handleExportPdf = async () => {
    if (!dashboardRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf({
        element: dashboardRef.current,
        filename: config?.title || 'dashboard',
      });
      notify('Print dialog opened. Choose "Save as PDF" to download.', 'success');
    } catch (e) {
      console.error('PDF export failed', e);
      notify(e?.message || 'PDF export failed. Please allow popups/print dialog and try again.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!config) return null;

  return (
    <div ref={dashboardRef} className="space-y-6 overflow-y-scroll p-6">
      <DashboardHeader
        config={config}
        derivedKpiId={derivedKpiId}
        onDerivedKpiChange={onDerivedKpiChange}
        focusedRoleId={focusedRoleId}
        onRoleChange={onRoleChange}
        selectedCycleYear={selectedCycleYear}
        onYearChange={onYearChange}
        quarter={quarter}
        setQuarter={setQuarter}
        isExportingPdf={isExportingPdf}
        onExportPdf={handleExportPdf}
      />

      <OverallPerformance stats={config.stats} />

      <PerformanceComparison subUnits={config.subUnits} />

      <PerformanceCharts config={config} />

      <DistributionAndHeatmap statusDistribution={config.statusDistribution} heatmap={config.heatmap} />

      <PerformersAndGaps topPerformers={config.topPerformers} achievementGap={config.achievementGap} />

      <DashboardFooter />
    </div>
  );
};

export default PerformanceDashboard;
