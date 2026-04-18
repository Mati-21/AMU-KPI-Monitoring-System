import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';

function FaculityDashboard() {
  const authUser = useSelector((state) => state.auth?.user);

  const config = useMemo(() => {
    const roleName = authUser?.roleName || authUser?.role || 'Role';
    const normalizedRole = String(roleName).toLowerCase();
    const permissions = Array.isArray(authUser?.permissions) ? authUser.permissions : [];

    const unitLabel = normalizedRole.includes('staff') ? 'Individual Targets' : normalizedRole.includes('chair') ? 'Teams' : 'Sub Units';
    const moduleCount = permissions.length || 6;
    const viewableModuleCount = permissions.filter((entry) => entry?.view).length || 4;
    const editModuleCount = permissions.filter((entry) => entry?.edit || entry?.create).length || 3;

    return {
      title: `${roleName} Dashboard`,
      subtitle: `Reusable dashboard view for ${roleName} based on role permissions`,
      yearOptions: ['2024-2025', '2023-2024'],
      stats: [
        {
          label: 'Assigned KPIs',
          value: String(Math.max(8, viewableModuleCount * 4)),
          color: 'primary',
          progress: 76,
          subtitle: `Based on ${viewableModuleCount} active permission modules`,
        },
        { label: 'Permission Modules', value: String(moduleCount), color: 'blue', subtitle: 'Modules available to your role' },
        { label: unitLabel, value: String(Math.max(1, editModuleCount)), color: 'green' },
        { label: 'Avg Score', value: '78%', color: 'amber', progress: 78 },
      ],
      subUnitLabel: unitLabel,
      subUnits: [
        { name: `${roleName} Unit A`, totalKpis: 8, trend: 'Improving', achieved: 5, inProgress: 2, delayed: 1, color: 'primary' },
        { name: `${roleName} Unit B`, totalKpis: 6, trend: 'Stable', achieved: 4, inProgress: 1, delayed: 1, color: 'green' },
        { name: `${roleName} Unit C`, totalKpis: 5, trend: 'Improving', achieved: 3, inProgress: 1, delayed: 1, color: 'blue' },
      ],
      quarterlyData: [
        { name: 'Unit A', q1: 72, q2: 76, q3: 80, q4: 84 },
        { name: 'Unit B', q1: 68, q2: 72, q3: 76, q4: 79 },
        { name: 'Unit C', q1: 65, q2: 69, q3: 73, q4: 77 },
      ],
      yearlyTrend: [
        { year: '2020', score: 60 },
        { year: '2021', score: 66 },
        { year: '2022', score: 71 },
        { year: '2023', score: 75 },
        { year: '2024', score: 78 },
      ],
      statusDistribution: [
        { name: 'Achieved', value: 42, color: 'hsl(142 71% 45%)' },
        { name: 'In Progress', value: 34, color: 'hsl(45 93% 47%)' },
        { name: 'Delayed', value: 17, color: 'hsl(0 84% 60%)' },
        { name: 'Critical', value: 7, color: 'hsl(0 0% 45%)' },
      ],
      heatmap: [
        { pillar: 'Unit A', q1: 78, q2: 80, q3: 83, q4: 85 },
        { pillar: 'Unit B', q1: 70, q2: 73, q3: 76, q4: 79 },
        { pillar: 'Unit C', q1: 64, q2: 68, q3: 71, q4: 75 },
      ],
      topPerformers: [
        { name: 'Top Performer 1', unit: 'Unit A', score: 91 },
        { name: 'Top Performer 2', unit: 'Unit B', score: 88 },
        { name: 'Top Performer 3', unit: 'Unit C', score: 84 },
        { name: 'Top Performer 4', unit: 'Unit A', score: 82 },
      ],
      achievementGap: [
        { name: 'Unit A', target: 90, actual: 85 },
        { name: 'Unit B', target: 84, actual: 79 },
        { name: 'Unit C', target: 80, actual: 75 },
      ],
    };
  }, [authUser?.permissions, authUser?.role, authUser?.roleName]);

  return <PerformanceDashboard config={config} />;
}

export default FaculityDashboard;
