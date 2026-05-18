import { useState, useEffect } from 'react';
import { Users, BarChart3, Palette, Shield, Activity } from 'lucide-react';
import StatCard from '../components/StatCard';
import UserStatsCharts from '../components/UserStatsCharts';
import QuickActions from '../components/QuickActions';
import ActivityLog from '../components/ActivityLog';
import { useNavigate } from 'react-router-dom';
import { useAdminDashboardQuery } from '../../../Hooks/Queries/useDashboard';
import { useCycleYearsQuery } from '../../../Hooks/Queries/useKpis';
import { useSelector } from 'react-redux';
import permissionUtils from '../../../lib/permissionUtils';

const iconMap = {
  'Total Users': Users,
  'Total KPIs': BarChart3,
  'Total Themes': Palette,
  'Total Roles': Shield,
  'Active KPIs': Activity,
};

function AdminDashboard() {
  const [selectedCycleYear, setSelectedCycleYear] = useState('');
  const { data: cycleYearsData } = useCycleYearsQuery();
  const activeCycleYearFromServer = cycleYearsData?.activeCycleYear || '';
  const availableYears = Array.isArray(cycleYearsData?.years) ? cycleYearsData.years : [];

  useEffect(() => {
    if (!selectedCycleYear && activeCycleYearFromServer) {
      setSelectedCycleYear(activeCycleYearFromServer);
    }
  }, [activeCycleYearFromServer, selectedCycleYear]);

  const { data, isLoading: loading, error: queryError } = useAdminDashboardQuery(selectedCycleYear);
  const error = queryError?.response?.data?.message || '';
  const navigate = useNavigate();
  const userPermissions = useSelector((state) => state.auth?.user?.permissions || []);
  const canViewSystemLogs = permissionUtils.hasPermission(userPermissions, permissionUtils.permissionKey('view', 'System Logs'));

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  const getAddHandler = (label) => {
    switch (label) {
      case 'Total Users':
        return () => navigate('/user-management?tab=add');
      case 'Total KPIs':
        return () => navigate('/kpi?tab=addKpi');
      case 'Total Themes':
        return () => navigate('/kpi?tab=addKpiCategory');
      case 'Total Roles':
        return () => navigate('/role-management?tab=addRole');
      default:
        return null;
    }
  };

  const stats =
    data?.stats?.map((s) => ({
      ...s,
      icon: iconMap[s.label] || Activity,
      onAdd: getAddHandler(s.label),
    })) || [];

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor Operational excellence and manage organizational assets</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Cycle Year:</span>
            <select
              value={selectedCycleYear || activeCycleYearFromServer || ''}
              onChange={(e) => setSelectedCycleYear(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none min-w-[120px] font-medium"
            >
              <option value="" disabled>Select Year</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year} {year === activeCycleYearFromServer && '(Active)'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* User Stats Charts */}
      <div className="mb-6">
        <UserStatsCharts
          activeUsersData={data?.activeUsersTrend}
          loginActivityData={data?.loginActivityData}
          statusData={data?.userStatusDistribution}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <QuickActions />
      </div>

      {/* Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityLog
          title="Recent System Activity"
          activities={data?.systemActivities}
          onViewAll={canViewSystemLogs ? () => navigate('/system-logs?tab=system') : undefined}
        />
        <ActivityLog
          title="Administrator Log"
          activities={data?.adminActivities}
          onViewAll={canViewSystemLogs ? () => navigate('/system-logs?tab=admin') : undefined}
        />
      </div>
    </main>
  );
}

export default AdminDashboard;
