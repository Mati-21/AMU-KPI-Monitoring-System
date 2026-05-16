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

const DEFAULT_DERIVED_KPI_FILTER = '__ALL__';

const isDerivedAssignment = (assignment) => {
  // Backend rule (see userKPIController): Derived if it has either a local Name or a local Remark.
  const directRemark = String(assignment?.Remark || '').trim();
  const directName = String(assignment?.Name || '').trim();
  return Boolean(directRemark || directName);
};

const getAssignmentId = (assignment) => {
  return String(assignment?.Id || '');
};

const getDerivedKpiLabel = (assignment) => {
  return (
    assignment?.Name ||
    assignment?.KPI?.Description ||
    assignment?.KPI?.KPIType?.KPIName ||
    assignment?.KPI?.KPIType?.KPIName ||
    assignment?.KPI?.Description ||
    `KPI ${getAssignmentId(assignment)}`
  );
};

export const useDashboardData = ({ derivedKpiId = DEFAULT_DERIVED_KPI_FILTER, cycleYear, focusedRoleId = '__ALL__' } = {}) => {
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
        queryFn: () => api.get('/user-kpis', { params: { scope: 'mine', fromParent: 'true', ...(cycleYear ? { cycleYear } : {}) } }).then(res => res.data?.data || []),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: [...queryKeys.kpis.list({}), cycleYear],
        queryFn: () => api.get('/kpis', fetchOptions).then(res => res.data?.data || []),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: [...queryKeys.kpis.types, cycleYear],
        queryFn: () => api.get('/kpi-types', fetchOptions).then(res => res.data?.data || []),
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
      },
      {
        queryKey: [...queryKeys.kpis.assignments({}), cycleYear],
        queryFn: () => api.get('/user-kpis', fetchOptions).then(res => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
      },
      {
        queryKey: ['user-roles', cycleYear],
        queryFn: () => api.get('/user-roles', fetchOptions).then(res => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
      },
      {
        queryKey: [...queryKeys.roles.all, cycleYear],
        queryFn: () => api.get('/roles', fetchOptions).then(res => res.data?.data || []),
        retry: false,
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60, // 1 hour
      }
    ]
  });

  const [parentReceivedAssignmentsRes, kpisRes, kpiTypesRes, assignmentsRes, userRolesRes, rolesRes] = results;

  const loading = results.some(r => r.isLoading);
  const error = results.find(r => r.error)?.error?.message || '';

  const data = useMemo(() => {
    if (loading || error || !results.every(r => r.data)) return { child: null, parentReceived: null, raw: null };

    const parentReceivedAssignmentsRaw = parentReceivedAssignmentsRes.data || [];
    const kpis = kpisRes.data || [];
    const kpiTypes = kpiTypesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const userRoles = userRolesRes.data || [];
    const roles = rolesRes.data || [];

    // Map child roles
    // Map direct child roles only
    const childRoleIds = new Set(
      roles.filter((role) => String(role?.ParentRoleId || '') === currentRoleId).map((role) => String(role?.Id || ''))
    );

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

    if (isChildOfExtraMeasure) {
      parentReceivedAssignments = parentReceivedAssignments.filter((a) => isDerivedAssignment(a));
    }

    const assignmentsForSubUnits = assignments.filter((a) => {
      const assignedUserId = String(a.UserId || a.User?.Id || '');
      const createdBy = String(a.CreatedBy || '');
      
      // Check if user is in a direct child role
      const userRoles = a.User?.UserRoles || [];
      const isDirectChild = userRoles.some(ur => childRoleIds.has(String(ur.RoleId || ur.Role?.Id)));
      
      // OR if it was explicitly assigned by the current user
      const isAssignedByMe = createdBy === currentUserId;

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
    const normalizedRole = roleName.toLowerCase();
    const unitLabel = normalizedRole.includes('staff') ? 'Personal Goals' : normalizedRole.includes('chair') ? 'Teams' : 'Sub Units';
    // A user is in "Staff View" if explicitly marked non-distributable OR their role name contains 'staff'
    const isStaffView = authUser?.isDistributable === false || normalizedRole.includes('staff');

    const derivedFilterId = String(derivedKpiId || DEFAULT_DERIVED_KPI_FILTER);

    const derivedKpiOptions = (() => {
      const assignments = data.raw?.parentReceivedAssignments || [];
      const derived = assignments.filter((a) => isDerivedAssignment(a));
      const out = [];
      derived.forEach((a) => {
        const assignmentId = getAssignmentId(a);
        if (!assignmentId) return;
        out.push({ value: assignmentId, label: getDerivedKpiLabel(a) });
      });
      return out;
    })();

    const applyFilters = (assignments) => {
      let list = Array.isArray(assignments) ? assignments : [];
      
      // Filter by Derived KPI if requested
      if (derivedFilterId && derivedFilterId !== DEFAULT_DERIVED_KPI_FILTER) {
        list = list.filter((a) => getAssignmentId(a) === derivedFilterId);
      }
      
      // Filter by Focused Role if requested
      if (focusedRoleId && focusedRoleId !== '__ALL__') {
        const targetRoleId = String(focusedRoleId);
        // Find users in this role
        const usersInRole = new Set(
          (data.raw?.userRoles || [])
            .filter(ur => String(ur.RoleId || ur.Role?.Id) === targetRoleId)
            .map(ur => String(ur.UserId))
        );
        list = list.filter(a => usersInRole.has(String(a.UserId)));
      }

      return list;
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
      yearOptions: ['Current Cycle'],
      isLoading: loading,
      loadError: error,
      hasData,
      childRoleOptions: data.childRoleOptions || [],
      focusedRoleId,
      derivedKpiOptions,
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
      statusDistribution: computed.child?.statusDistribution || [],
      heatmap: computed.child?.heatmap || [],
      topPerformers: computed.child?.topPerformers || [],
      achievementGap: computed.child?.achievementGap || [],
      quarterlyComparison: computed.child?.quarterlyComparison || [],
    };
  }, [roleName, data, loading, error, authUser, derivedKpiId, focusedRoleId]);

  return { config, rawData: data, loading, error };
};
