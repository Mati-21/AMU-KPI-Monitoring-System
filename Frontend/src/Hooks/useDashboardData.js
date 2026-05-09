/**
 * useDashboardData.js
 * Custom hook for fetching and processing KPI performance data for dashboards.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api/axios';
import { buildDashboardData, safePercent } from '../lib/dashboardUtils';

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

export const useDashboardData = ({ derivedKpiId = DEFAULT_DERIVED_KPI_FILTER } = {}) => {
  const authUser = useSelector((state) => state.auth?.user);
  const [data, setData] = useState({ child: null, parentReceived: null, raw: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentUserId = String(authUser?.id || authUser?.Id || '');
  const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');
  const roleName = authUser?.roleName || authUser?.role || 'User';

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!currentUserId) return;
      setLoading(true);
      setError('');
      try {
        const fetchOptions = { params: { t: Date.now() } };

        // Essential data for all users
        const [parentReceivedRes, kpiRes, kpiTypeRes] = await Promise.all([
          api.get('/user-kpis', { params: { scope: 'mine', fromParent: 'true', t: Date.now() } }),
          api.get('/kpis', fetchOptions),
          api.get('/kpi-types', fetchOptions),
        ]);

        if (!mounted) return;

        // Optional data (may fail if user lacks managerial permission)
        let assignments = [];
        let userRoles = [];
        let roles = [];
        try {
          const [assignmentsRes, userRolesRes, rolesRes] = await Promise.all([
            api.get('/user-kpis', fetchOptions),
            api.get('/user-roles', fetchOptions),
            api.get('/roles', fetchOptions),
          ]).catch(() => [[], [], []]); // Silently handle 403s

          assignments = assignmentsRes?.data?.data || [];
          userRoles = userRolesRes?.data?.data || [];
          roles = rolesRes?.data?.data || [];
        } catch (adminErr) {
          console.warn('Managerial data could not be loaded.', adminErr);
        }

        let parentReceivedAssignments = parentReceivedRes?.data?.data || [];
        const kpis = kpiRes?.data?.data || [];
        const kpiTypes = kpiTypeRes?.data?.data || [];

        // Map child roles
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

        // If the role is in an "Extra Measure" context, only show Derived KPIs (those with a Remark/link)
        if (isChildOfExtraMeasure) {
          const totalBefore = parentReceivedAssignments.length;
          parentReceivedAssignments = parentReceivedAssignments.filter((a) => isDerivedAssignment(a));
          console.log(`[Dashboard Context] Role: ${roleName} | Extra Measure Context: YES`);
          console.log(`[Filtering] Found ${totalBefore} total KPIs. Kept ${parentReceivedAssignments.length} Derived KPIs.`);
        } else {
          console.log(`[Dashboard Context] Role: ${roleName} | Extra Measure Context: NO (Standard KPIs)`);
        }

        const assignmentsForSubUnits = assignments.filter((a) => {
          const assignedUserId = String(a.UserId || a.User?.Id || '');
          return childUserIds.has(assignedUserId);
        });

        const assignmentsForBreakdown = assignmentsForSubUnits.length > 0 ? assignmentsForSubUnits : parentReceivedAssignments;

        const childData = buildDashboardData(assignmentsForBreakdown, kpis, kpiTypes, roleNameByUserId, activeSubUnitNames);
        const parentReceivedData = buildDashboardData(parentReceivedAssignments, kpis, kpiTypes, roleNameByUserId);

        if (parentReceivedAssignments.length > 0) {
          console.log(`--- KPI Assignments for ${roleName} ---`);
          console.table(
            parentReceivedAssignments.map((a) => ({
              id: a.Id,
              type: a.Remark ? 'DERIVED' : 'ORIGINAL',
              name: a.KPI?.Description || a.KPI?.KPIType?.KPIName || 'Unknown',
              target: a.AssignedTarget || a.KPI?.Target,
              remark: a.Remark,
            }))
          );
        }

        setData({
          child: childData,
          parentReceived: parentReceivedData,
          raw: {
            parentReceivedAssignments,
            assignmentsForSubUnits,
            kpis,
            kpiTypes,
            roleNameByUserId,
            activeSubUnitNames,
          },
        });
      } catch (err) {
        if (!mounted) return;
        const msg = err?.response?.data?.message || err.message || 'Failed to load dashboard data.';
        setError(msg);
        console.error('Dashboard Data Fetch Error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [currentUserId, currentRoleId]);

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

    const applyDerivedFilter = (assignments) => {
      const list = Array.isArray(assignments) ? assignments : [];
      if (!derivedFilterId || derivedFilterId === DEFAULT_DERIVED_KPI_FILTER) return list;
      return list.filter((a) => getAssignmentId(a) === derivedFilterId);
    };

    const computed = (() => {
      if (!data.raw) {
        return { child: data.child, parentReceived: data.parentReceived };
      }

      const parentReceivedAssignmentsFiltered = applyDerivedFilter(data.raw.parentReceivedAssignments);
      const assignmentsForSubUnitsFiltered = applyDerivedFilter(data.raw.assignmentsForSubUnits);

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
  }, [roleName, data, loading, error, authUser, derivedKpiId]);

  return { config, rawData: data, loading, error };
};
