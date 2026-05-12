import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TabButton from '../../../Components/UI/TabButton';
import KpiList from './KpiList';
import RegisterKpi from './RegisterKpi';
import RegisterUnit from './RegisterUnit';
import RegisterCategory from './RegisterCategory';

const KpiManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab || 'list');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'list') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const tabs = [
    { key: 'list', label: 'Lists' },
    { key: 'addKpi', label: 'Register KPI' },
    { key: 'addKpiCategory', label: 'Register Theme / Sub-Theme' },
    { key: 'addKpiUnit', label: 'Register Unit' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background ">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 space-y-8 overflow-y-auto">
          <h1 className="text-2xl font-bold">KPI Management</h1>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <TabButton key={tab.key} label={tab.label} value={tab.key} activeValue={activeTab} onChange={handleTabChange} />
            ))}
          </div>

          {activeTab === 'list' && <KpiList refreshKey={refreshKey} />}
          {activeTab === 'addKpi' && <RegisterKpi setActiveTab={handleTabChange} onSaved={() => setRefreshKey((prev) => prev + 1)} />}
          {activeTab === 'addKpiCategory' && <RegisterCategory setActiveTab={handleTabChange} onSaved={() => setRefreshKey((prev) => prev + 1)} />}
          {activeTab === 'addKpiUnit' && <RegisterUnit setActiveTab={handleTabChange} onSaved={() => setRefreshKey((prev) => prev + 1)} />}
        </main>
      </div>
    </div>
  );
};

export default KpiManagement;
