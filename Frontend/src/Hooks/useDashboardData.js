/**
 * useDashboardData.js
 * Custom hook for fetching and processing KPI performance data for dashboards.
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useQueries } from '@tanstack/react-query';
import { api } from '../api/axios';
import { buildDashboardData, safePercent } from '../lib/dashboardUtils';
import { queryKeys } from '../Config/queryKeys';

export const useDashboardData = ({ cycleYear, focusedRoleId = '__ALL__' } = {}) => {
  const authUser = useSelector((state) => state.auth?.user);
  const currentUserId = String(authUser?.id || authUser?.Id || '');
  const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');
  const roleName = authUser?.roleName || authUser?.role || 'User';

  const fetchOptions = { params: { ...(cycleYear ? { cycleYear } : {}) } };

  // Use useQueries for parallel fetching
  const results = useQueries({
    queries: [
      {
        queryKey: [...queryKeys.kpis.assignments({ scope: 'mine', fromParent: 'true' }), cycleYear],
        queryFn: () =>
          api
            .get('/user-kpis', { params: { scope: 'mine', fromParent: 'true', ...(cycleYear ? { cycleYear } : {}) } })
            .then((res) => res.data?.data || []),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: [...queryKeys.kpis.list({}), cycleYear],
        queryFn: () => api.get('/kpis', fetchOptions).then((res) => res.data?.data || []),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: [...queryKeys.kpis.types, cycleYear],
        queryFn: () => api.get('/kpi-types', fetchOptions).then((res) => res.data?.data || []),
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
      },
      {
        queryKey: [...queryKeys.kpis.assignments({}), cycleYear],
        queryFn: () => api.get('/user-kpis', fetchOptions).then((res) => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: ['user-roles', cycleYear],
        queryFn: () => api.get('/user-roles', fetchOptions).then((res) => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
      },
      {
        queryKey: [...queryKeys.roles.all, cycleYear],
        queryFn: () => api.get('/roles', fetchOptions).then((res) => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
      },
    ],
  });

  const [parentReceivedAssignmentsRes, kpisRes, kpiTypesRes, assignmentsRes, userRolesRes, rolesRes] = results;

  const loading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error?.message || '';

  const data = useMemo(() => {
    if (loading || error || !results.every((r) => r.data)) return { child: null, parentReceived: null, raw: null };

    const parentReceivedAssignmentsRaw = parentReceivedAssignmentsRes.data || [];
    const kpis = kpisRes.data || [];
    const kpiTypes = kpiTypesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const userRoles = userRolesRes.data || [];
    const roles = rolesRes.data || [];

    // Map child roles
    // Map direct child roles only
    const childRoleIds = new Set(roles.filter((role) => String(role?.ParentRoleId || '') === currentRoleId).map((role) => String(role?.Id || '')));

    const roleNameByUserId = new Map();
    const roleMap = new Map(roles.map((r) => [String(r.Id), r]));

    userRoles.forEach((ur) => {
      const roleId = String(ur.RoleId || ur.Role?.Id || '');
      if (!childRoleIds.has(roleId)) return;
      const userId = String(ur.UserId || ur.User?.Id || '');
      const rName = roleMap.get(roleId)?.RoleName || ur.Role?.RoleName;
      if (rName) roleNameByUserId.set(userId, rName);
    });

    const activeSubUnitNames = [...new Set([...roleNameByUserId.values()])];
    const childUserIds = new Set([...roleNameByUserId.keys()]);

    const currentRole = roleMap.get(currentRoleId);
    const parentRole = currentRole?.ParentRoleId ? roleMap.get(String(currentRole.ParentRoleId)) : null;
    const isChildOfExtraMeasure = parentRole?.IsExtraMeasure === true || currentRole?.IsExtraMeasure === true;

    let parentReceivedAssignments = [...parentReceivedAssignmentsRaw];

    const assignmentsForSubUnits = assignments.filter((a) => {
      const assignedUserId = String(a.UserId || a.User?.Id || '');
      const createdBy = String(a.CreatedBy || '');

      // Never include the scope holder's own assignments in sub-unit data
      if (assignedUserId === currentUserId) return false;

      // Check if user is in a direct child role
      const userRolesForAssignment = a.User?.UserRoles || [];
      const isDirectChild = userRolesForAssignment.some((ur) => childRoleIds.has(String(ur.RoleId || ur.Role?.Id)));

      // OR if it was explicitly assigned by the current user to someone else
      const isAssignedByMe = createdBy === currentUserId && assignedUserId !== currentUserId;

      return isDirectChild || isAssignedByMe;
    });

    const assignmentsForBreakdown = assignmentsForSubUnits.length > 0 ? assignmentsForSubUnits : parentReceivedAssignments;

    const childData = buildDashboardData(assignmentsForBreakdown, kpis, kpiTypes, roleNameByUserId, activeSubUnitNames);
    const parentReceivedData = buildDashboardData(parentReceivedAssignments, kpis, kpiTypes, roleNameByUserId);

    const childRoleOptions = roles
      .filter((role) => String(role?.ParentRoleId || '') === currentRoleId)
      .map((role) => ({ value: String(role.Id), label: role.RoleName }));

    return {
      child: childData,
      parentReceived: parentReceivedData,
      childRoleOptions,
      raw: {
        parentReceivedAssignments,
        assignmentsForSubUnits,
        kpis,
        kpiTypes,
        roles,
        userRoles,
        roleNameByUserId,
        activeSubUnitNames,
      },
    };
  }, [results, currentUserId, currentRoleId, loading, error]);

  const config = useMemo(() => {
    const normalizedRole = String(roleName || '').toLowerCase();
    const isStaffView = normalizedRole.includes('staff');
    const unitLabel = isStaffView ? 'Staff' : 'Sub-Units';

    const applyFilters = (list) => {
      let filtered = Array.isArray(list) ? list : [];

      if (focusedRoleId && focusedRoleId !== '__ALL__') {
        const targetRoleId = String(focusedRoleId);
        const usersInRole = new Set(
          (data.raw?.userRoles || [])
            .filter((ur) => String(ur.RoleId || ur.Role?.Id) === targetRoleId)
            .map((ur) => String(ur.UserId || ur.User?.Id || ''))
            .filter(Boolean)
        );

        filtered = filtered.filter((assignment) => usersInRole.has(String(assignment.UserId || assignment.User?.Id || '')));
      }

      return filtered;
    };

    const computed = (() => {
      if (!data.raw) {
        return { child: data.child, parentReceived: data.parentReceived };
      }

      const parentReceivedAssignmentsFiltered = applyFilters(data.raw.parentReceivedAssignments);
      const assignmentsForSubUnitsFiltered = applyFilters(data.raw.assignmentsForSubUnits);

      const assignmentsForBreakdown = assignmentsForSubUnitsFiltered.length > 0 ? assignmentsForSubUnitsFiltered : parentReceivedAssignmentsFiltered;

      const childData = buildDashboardData(
        assignmentsForBreakdown,
        data.raw.kpis,
        data.raw.kpiTypes,
        data.raw.roleNameByUserId,
        data.raw.activeSubUnitNames
      );

      const parentReceivedData = buildDashboardData(parentReceivedAssignmentsFiltered, data.raw.kpis, data.raw.kpiTypes, data.raw.roleNameByUserId);

      return { child: childData, parentReceived: parentReceivedData };
    })();

    // Keep overall gating ("No Performance Data" screen) based on the unfiltered dataset.
    const overallAssignedKpis = data.parentReceived?.assignedKpis || 0;
    const overallChildAssignedKpis = data.child?.assignedKpis || 0;

    const receivedAssignedKpis = computed.parentReceived?.assignedKpis || 0;
    const receivedAchievedKpis = computed.parentReceived?.achievedKpis || 0;
    const receivedInProgressKpis = computed.parentReceived?.inProgressKpis || 0;
    const receivedDelayedKpis = computed.parentReceived?.delayedKpis || 0;
    const receivedAvgScore = computed.parentReceived?.avgScore || 0;

    const hasData = overallAssignedKpis > 0 || overallChildAssignedKpis > 0;

    return {
      title: `${roleName} Dashboard`,
      subtitle: `Real-time KPI performance tracking for ${roleName}`,
      yearOptions: ['2018'],
      isLoading: loading,
      loadError: error,
      hasData,
      childRoleOptions: data.childRoleOptions || [],
      focusedRoleId,
      isDistributable: !isStaffView,
      stats: [
        {
          label: 'Assigned KPIs',
          value: String(receivedAssignedKpis),
          color: 'primary',
          progress: safePercent(receivedAssignedKpis ? (receivedAchievedKpis / receivedAssignedKpis) * 100 : 0),
          subtitle: 'KPIs assigned to you',
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
          label: 'My Score',
          value: `${receivedAvgScore}%`,
          color: receivedAvgScore >= 80 ? 'green' : receivedAvgScore >= 60 ? 'amber' : 'red',
          progress: receivedAvgScore,
        },
      ],
      subUnitLabel: unitLabel,
      subUnits: computed.child?.subUnits || [],
      quarterlyData: computed.child?.quarterlyData || [],
      // Prefer KPI-per-line trend series for all roles.
      // Staff view uses non-cumulative quarterly percentages; non-staff uses cumulative progress.
      yearlyTrend: isStaffView ? computed.child?.kpiQuarterlyTrends || [] : computed.child?.kpiTrends || computed.child?.yearlyTrend || [],
      kpiNames: computed.child?.kpiNames || [],
      kpiTrends: computed.child?.kpiTrends || [],
      statusDistribution: [
        { name: 'Achieved', value: safePercent(receivedAssignedKpis ? (receivedAchievedKpis / receivedAssignedKpis) * 100 : 0), color: 'hsl(142 71% 45%)' },
        { name: 'In Progress', value: safePercent(receivedAssignedKpis ? (receivedInProgressKpis / receivedAssignedKpis) * 100 : 0), color: 'hsl(45 93% 47%)' },
        { name: 'Delayed', value: safePercent(receivedAssignedKpis ? (receivedDelayedKpis / receivedAssignedKpis) * 100 : 0), color: 'hsl(0 84% 60%)' },
      ],
      heatmap: computed.child?.heatmap || [],
      topPerformers: computed.child?.topPerformers || [],
      achievementGap: computed.child?.achievementGap || [],
      quarterlyComparison: computed.child?.quarterlyComparison || [],
    };
  }, [roleName, data, loading, error, focusedRoleId]);

  return { config, rawData: data, loading, error };
};
