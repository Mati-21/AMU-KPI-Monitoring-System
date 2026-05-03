import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import PerformanceDashboard from '../../Components/Dashboard/PerformanceDashboard';
import { api } from '../../api/axios';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const safePercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(Number(value))));
};

const average = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const trendFromQuarterScores = (scores) => {
  const ordered = ['q1', 'q2', 'q3', 'q4'].map((key) => scores[key]).filter((value) => Number.isFinite(value));

  if (ordered.length < 2) {
    return 'Stable';
  }

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const delta = last - first;

  if (delta > 4) return 'Improving';
  if (delta < -4) return 'Declining';
  return 'Stable';
};

const isActiveRoleAssignment = (assignment) => {
  if (!assignment || assignment.IsArchived) return false;
  if (!assignment.ToDate) return true;
  return new Date(assignment.ToDate).getTime() >= Date.now();
};

const getThemeName = (kpiRecord, typeById) => {
  if (!kpiRecord?.KPITypeId) {
    return 'Uncategorized';
  }

  const leaf = typeById.get(kpiRecord.KPITypeId);
  const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
  const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;

  return theme?.KPIName || subTheme?.KPIName || leaf?.KPIName || 'Uncategorized';
};

const buildDashboardData = (assignments, kpis, kpiTypes, roleNameByUserId, activeSubUnitNames = []) => {
  const kpiById = new Map((Array.isArray(kpis) ? kpis : []).map((kpi) => [kpi.Id, kpi]));
  const typeById = new Map((Array.isArray(kpiTypes) ? kpiTypes : []).map((type) => [type.Id, type]));

  const groups = new Map();
  const overallQuarterValues = { q1: [], q2: [], q3: [], q4: [] };

  (Array.isArray(activeSubUnitNames) ? activeSubUnitNames : []).forEach((name) => {
    const normalizedName = String(name || '').trim();
    if (!normalizedName || groups.has(normalizedName)) return;

    groups.set(normalizedName, {
      name: normalizedName,
      totalKpis: 0,
      achieved: 0,
      inProgress: 0,
      delayed: 0,
      targets: [],
      actuals: [],
      quarterScores: { q1: [], q2: [], q3: [], q4: [] },
    });
  });

  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const kpiRecord = kpiById.get(assignment.KPIId) || assignment.KPI;
    const assignedUserId = String(assignment?.UserId || assignment?.User?.Id || '');
    const childRoleName = roleNameByUserId?.get(assignedUserId);
    const fallbackUserName =
      assignment?.User?.UserName ||
      [assignment?.User?.FirstName, assignment?.User?.FatherName, assignment?.User?.GrandFatherName].filter(Boolean).join(' ');
    const groupName = childRoleName || fallbackUserName || getThemeName(kpiRecord, typeById);
    const targetValue = toNumber(assignment.AssignedTarget ?? kpiRecord?.Target);

    const q1 = toNumber(assignment.q1);
    const q2 = toNumber(assignment.q2);
    const q3 = toNumber(assignment.q3);
    const q4 = toNumber(assignment.q4);

    if (Number.isFinite(q1)) overallQuarterValues.q1.push(q1);
    if (Number.isFinite(q2)) overallQuarterValues.q2.push(q2);
    if (Number.isFinite(q3)) overallQuarterValues.q3.push(q3);
    if (Number.isFinite(q4)) overallQuarterValues.q4.push(q4);

    const quarterAverage = average([q1, q2, q3, q4]);
    const hasSubmission = Number.isFinite(q1) || Number.isFinite(q2) || Number.isFinite(q3) || Number.isFinite(q4);

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        name: groupName,
        totalKpis: 0,
        achieved: 0,
        inProgress: 0,
        delayed: 0,
        targets: [],
        actuals: [],
        quarterScores: { q1: [], q2: [], q3: [], q4: [] },
      });
    }

    const group = groups.get(groupName);
    group.totalKpis += 1;

    if (Number.isFinite(targetValue)) {
      group.targets.push(targetValue);
    }

    if (Number.isFinite(quarterAverage)) {
      group.actuals.push(quarterAverage);
    }

    if (Number.isFinite(q1)) group.quarterScores.q1.push(q1);
    if (Number.isFinite(q2)) group.quarterScores.q2.push(q2);
    if (Number.isFinite(q3)) group.quarterScores.q3.push(q3);
    if (Number.isFinite(q4)) group.quarterScores.q4.push(q4);

    if (!hasSubmission) {
      group.inProgress += 1;
      return;
    }

    if (Number.isFinite(targetValue)) {
      if (quarterAverage >= targetValue) {
        group.achieved += 1;
      } else if (quarterAverage < targetValue * 0.6) {
        group.delayed += 1;
      } else {
        group.inProgress += 1;
      }
      return;
    }

    if (quarterAverage >= 80) {
      group.achieved += 1;
    } else if (quarterAverage < 50) {
      group.delayed += 1;
    } else {
      group.inProgress += 1;
    }
  });

  const groupedEntries = [...groups.values()];
  const assignedKpis = groupedEntries.reduce((sum, item) => sum + item.totalKpis, 0);
  const achievedKpis = groupedEntries.reduce((sum, item) => sum + item.achieved, 0);
  const inProgressKpis = groupedEntries.reduce((sum, item) => sum + item.inProgress, 0);
  const delayedKpis = groupedEntries.reduce((sum, item) => sum + item.delayed, 0);

  const allActuals = groupedEntries.flatMap((item) => item.actuals);
  const avgScore = safePercent(average(allActuals) || 0);

  const subUnits = groupedEntries
    .map((item, index) => {
      const q1 = average(item.quarterScores.q1);
      const q2 = average(item.quarterScores.q2);
      const q3 = average(item.quarterScores.q3);
      const q4 = average(item.quarterScores.q4);
      const meanScore = average([q1, q2, q3, q4]) || average(item.actuals) || 0;
      const colors = ['primary', 'green', 'blue', 'amber', 'purple', 'red'];

      return {
        name: item.name,
        totalKpis: item.totalKpis,
        trend: trendFromQuarterScores({ q1, q2, q3, q4 }),
        achieved: item.achieved,
        inProgress: item.inProgress,
        delayed: item.delayed,
        color: colors[index % colors.length],
        score: safePercent(meanScore),
        target: safePercent(average(item.targets) || 0),
        q1: safePercent(q1 || 0),
        q2: safePercent(q2 || 0),
        q3: safePercent(q3 || 0),
        q4: safePercent(q4 || 0),
      };
    })
    .sort((left, right) => right.score - left.score);

  const overallQuarterAverages = {
    q1: safePercent(average(overallQuarterValues.q1) || 0),
    q2: safePercent(average(overallQuarterValues.q2) || 0),
    q3: safePercent(average(overallQuarterValues.q3) || 0),
    q4: safePercent(average(overallQuarterValues.q4) || 0),
  };

  const topSubUnits = subUnits.slice(0, 6);

  return {
    assignedKpis,
    achievedKpis,
    inProgressKpis,
    delayedKpis,
    avgScore,
    subUnits: topSubUnits,
    quarterlyData: topSubUnits.map((item) => ({ name: item.name, q1: item.q1, q2: item.q2, q3: item.q3, q4: item.q4 })),
    yearlyTrend: [
      { year: 'Q1', score: overallQuarterAverages.q1 },
      { year: 'Q2', score: overallQuarterAverages.q2 },
      { year: 'Q3', score: overallQuarterAverages.q3 },
      { year: 'Q4', score: overallQuarterAverages.q4 },
    ],
    statusDistribution: [
      { name: 'Achieved', value: safePercent(assignedKpis ? (achievedKpis / assignedKpis) * 100 : 0), color: 'hsl(142 71% 45%)' },
      { name: 'In Progress', value: safePercent(assignedKpis ? (inProgressKpis / assignedKpis) * 100 : 0), color: 'hsl(45 93% 47%)' },
      { name: 'Delayed', value: safePercent(assignedKpis ? (delayedKpis / assignedKpis) * 100 : 0), color: 'hsl(0 84% 60%)' },
    ],
    heatmap: topSubUnits.map((item) => ({ pillar: item.name, q1: item.q1, q2: item.q2, q3: item.q3, q4: item.q4 })),
    topPerformers: topSubUnits.slice(0, 4).map((item) => ({
      name: item.name,
      unit: `${item.totalKpis} KPI(s)`,
      score: item.score,
    })),
    achievementGap: topSubUnits.slice(0, 4).map((item) => ({
      name: item.name,
      target: item.target,
      actual: item.score,
    })),
  };
};

function FaculityDashboard() {
  const authUser = useSelector((state) => state.auth?.user);
  const [dashboardData, setDashboardData] = useState({
    child: null,
    parentReceived: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadPerformanceData = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [parentReceivedRes, assignmentsRes, userRolesRes, rolesRes, kpiRes, kpiTypeRes] = await Promise.all([
          api.get('/user-kpis', { params: { scope: 'mine', fromParent: true, t: Date.now() } }),
          api.get('/user-kpis', { params: { t: Date.now() } }),
          api.get('/user-roles', { params: { t: Date.now() } }),
          api.get('/roles', { params: { t: Date.now() } }),
          api.get('/kpis', { params: { t: Date.now() } }),
          api.get('/kpi-types', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        const parentReceivedAssignments = parentReceivedRes.data?.data || [];
        const assignments = assignmentsRes.data?.data || [];
        const userRoles = (userRolesRes.data?.data || []).filter(isActiveRoleAssignment);
        const roles = rolesRes.data?.data || [];
        const kpis = kpiRes.data?.data || [];
        const kpiTypes = kpiTypeRes.data?.data || [];

        const currentUserId = String(authUser?.id || authUser?.Id || '');
        const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');

        const childRoleIds = new Set(
          roles
            .filter((role) => String(role?.ParentRoleId || '') === currentRoleId)
            .map((role) => String(role?.Id || ''))
            .filter(Boolean)
        );

        const roleById = new Map((Array.isArray(roles) ? roles : []).map((role) => [String(role?.Id || ''), role]));
        const roleNameByUserId = new Map();

        userRoles.forEach((assignment) => {
          const roleId = String(assignment?.RoleId || assignment?.Role?.Id || '');
          if (!childRoleIds.has(roleId)) return;

          const userId = String(assignment?.UserId || assignment?.User?.Id || '');
          if (!userId || roleNameByUserId.has(userId)) return;

          const roleName = roleById.get(roleId)?.RoleName || assignment?.Role?.RoleName;
          if (roleName) {
            roleNameByUserId.set(userId, roleName);
          }
        });

        const activeSubUnitNames = [...new Set([...roleNameByUserId.values()].filter(Boolean))];

        const childUserIds = new Set([...roleNameByUserId.keys()]);
        const assignmentsForSubUnits = assignments.filter((assignment) => {
          const assignedUserId = String(assignment?.UserId || assignment?.User?.Id || '');
          if (!childUserIds.has(assignedUserId)) return false;

          const createdById = String(assignment?.CreatedBy || '');
          return !currentUserId || !createdById || createdById === currentUserId;
        });

        const childData = buildDashboardData(assignmentsForSubUnits, kpis, kpiTypes, roleNameByUserId, activeSubUnitNames);
        const parentReceivedData = buildDashboardData(parentReceivedAssignments, kpis, kpiTypes, roleNameByUserId);

        setDashboardData({
          child: childData,
          parentReceived: parentReceivedData,
        });
      } catch (error) {
        if (!mounted) return;
        setLoadError(error?.response?.data?.message || 'Failed to load dashboard performance data.');
        setDashboardData({ child: null, parentReceived: null });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPerformanceData();

    return () => {
      mounted = false;
    };
  }, [authUser?.Id, authUser?.RoleId, authUser?.currentRole?.Id, authUser?.currentRole?.RoleId, authUser?.id, authUser?.roleId]);

  const config = useMemo(() => {
    const roleName = authUser?.roleName || authUser?.role || 'Role';
    const normalizedRole = String(roleName).toLowerCase();
    const unitLabel = normalizedRole.includes('staff') ? 'Individual Targets' : normalizedRole.includes('chair') ? 'Teams' : 'Sub Units';
    const receivedAssignedKpis = dashboardData?.parentReceived?.assignedKpis || 0;
    const receivedAchievedKpis = dashboardData?.parentReceived?.achievedKpis || 0;
    const receivedInProgressKpis = dashboardData?.parentReceived?.inProgressKpis || 0;
    const receivedDelayedKpis = dashboardData?.parentReceived?.delayedKpis || 0;
    const receivedAvgScore = dashboardData?.parentReceived?.avgScore || 0;
    const hasData = receivedAssignedKpis > 0;

    return {
      title: `${roleName} Dashboard`,
      subtitle: `Live KPI performance snapshot for ${roleName}`,
      yearOptions: ['Current Cycle'],
      isLoading: loading,
      loadError,
      hasData,
      emptyMessage: 'No KPI performance data exists yet for this dashboard. Assign KPIs and submit quarterly results to populate charts.',
      stats: [
        {
          label: 'Assigned KPIs',
          value: String(receivedAssignedKpis),
          color: 'primary',
          progress: safePercent(receivedAssignedKpis ? (receivedAchievedKpis / receivedAssignedKpis) * 100 : 0),
          subtitle: 'KPIs received from parent role',
        },
        {
          label: 'Achieved',
          value: String(receivedAchievedKpis),
          color: 'green',
          progress: safePercent(receivedAssignedKpis ? (receivedAchievedKpis / receivedAssignedKpis) * 100 : 0),
        },
        {
          label: 'In Progress',
          value: String(receivedInProgressKpis),
          color: 'blue',
          progress: safePercent(receivedAssignedKpis ? (receivedInProgressKpis / receivedAssignedKpis) * 100 : 0),
        },
        {
          label: 'Avg Score',
          value: `${receivedAvgScore}%`,
          color: receivedDelayedKpis > 0 ? 'amber' : 'green',
          progress: receivedAvgScore,
        },
      ],
      subUnitLabel: unitLabel,
      subUnits: dashboardData?.child?.subUnits || [],
      quarterlyData: dashboardData?.child?.quarterlyData || [],
      yearlyTrend: dashboardData?.child?.yearlyTrend || [],
      statusDistribution: dashboardData?.child?.statusDistribution || [],
      heatmap: dashboardData?.child?.heatmap || [],
      topPerformers: dashboardData?.child?.topPerformers || [],
      achievementGap: dashboardData?.child?.achievementGap || [],
    };
  }, [authUser?.role, authUser?.roleName, dashboardData, loadError, loading]);

  return <PerformanceDashboard config={config} />;
}

export default FaculityDashboard;
