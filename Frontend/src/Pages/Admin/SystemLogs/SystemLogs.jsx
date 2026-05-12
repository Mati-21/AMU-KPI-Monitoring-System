import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TabButton from '../../../Components/UI/TabButton';
import ActivityLog from '../components/ActivityLog';
import { useAdminDashboard } from '../../../hooks/useAdminDashboard';
import { History, ShieldCheck } from 'lucide-react';

const SystemLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(requestedTab || 'system');
  const { data, loading, error } = useAdminDashboard();

  useEffect(() => {
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <main className="p-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">System & Administration Logs</h1>
          <p className="text-sm text-muted-foreground">Comprehensive audit trail of all system and administrative activities.</p>
        </div>

        <div className="flex gap-2">
          <TabButton
            label={
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Recent System Activity</span>
              </div>
            }
            value="system"
            activeValue={activeTab}
            onChange={handleTabChange}
          />
          <TabButton
            label={
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Administrator Log</span>
              </div>
            }
            value="admin"
            activeValue={activeTab}
            onChange={handleTabChange}
          />
        </div>

        <div className="animate-fade-in">
          {activeTab === 'system' ? (
            <ActivityLog
              title="Full System Activity Log"
              activities={data?.systemActivities}
              actionLabel="Export CSV"
            />
          ) : (
            <ActivityLog
              title="Full Administrator Audit Log"
              activities={data?.adminActivities}
              actionLabel="Export Security Log"
              actionVariant="destructive"
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SystemLogs;
