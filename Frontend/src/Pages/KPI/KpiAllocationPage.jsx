import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import Button from '../../Components/UI/Button';
import Checkbox from '../../Components/UI/Checkbox';
import { Input } from '../../Components/UI/Input';
import AssignedKpiList from '../../Components/KPI/AssignedKpiList';
import ChildOfficesModal from '../../Components/KPI/ChildOfficesModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import { Search, Trash2, PencilLine, Save, X, Eye } from 'lucide-react';
import { useNotification } from '../../Context/NotificationContext';
import { cn, emitReportDataChanged } from '../../lib/utils';
import { api } from '../../api/axios';
import MultiSelect from '../../Components/UI/MultiSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/UI/Table';
import { ScrollArea } from '../../Components/UI/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../Components/UI/dialog';
import permissionUtils from '../../lib/permissionUtils';
import { useRolesQuery } from '../../Hooks/Queries/useRoles';
import { useUserRolesQuery } from '../../Hooks/Queries/useUsers';
import {
  useKpisQuery,
  useKpiTypesQuery,
  useUserKpisQuery,
  useCreateUserKpiMutation,
  useBulkAssignUserKpisMutation,
  useUpdateUserKpiMutation,
  useDeleteUserKpiMutation,
  useBulkDeleteUserKpisMutation,
} from '../../Hooks/Queries/useKpis';

const CompactCellText = ({ value, maxWidth = 'max-w-[220px]' }) => (
  <p className={`truncate ${maxWidth}`} title={String(value || '')}>
    {value || '—'}
  </p>
);

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumericPreview = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return '—';
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
};

const compareCodes = (leftCode, rightCode) => {
  const leftParts = String(leftCode || '')
    .split('.')
    .map((part) => Number(part));
  const rightParts = String(rightCode || '')
    .split('.')
    .map((part) => Number(part));

  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }

  return 0;
};

const isActiveAssignment = (assignment) => {
  if (!assignment) return false;
  if (assignment.IsArchived) return false;
  if (!assignment.ToDate) return true;
  return new Date(assignment.ToDate).getTime() >= Date.now();
};

const getDefaultAssignmentOption = () => ({
  targetIndividual: false,
  customTargets: {},
});

const EMPTY_ARRAY = [];
const MINE_PARAMS = { scope: 'mine' };
const MINE_PARENT_PARAMS = { scope: 'mine', fromParent: true };
const SENT_PARAMS = { scope: 'sent' };

const KpiAllocationPage = () => {
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editForm, setEditForm] = useState({ baseline: '', target: '', remark: '' });
  const [customTargetModalState, setCustomTargetModalState] = useState({ open: false, kpiId: null });
  const [activeTab, setActiveTab] = useState('view');
  const [detailModal, setDetailModal] = useState({ open: false, title: '', data: null });
  const [savingAssignmentId, setSavingAssignmentId] = useState(null);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    isDestructive: true,
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState([]);
  const [selectedSubTheme, setSelectedSubTheme] = useState([]);
  const [selectedKpi, setSelectedKpi] = useState([]);
  const [kpiAssignmentOptions, setKpiAssignmentOptions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [themeFilter, setThemeFilter] = useState('all');

  // Queries
  const { data: roles = EMPTY_ARRAY, isLoading: loadingRoles, error: rolesError } = useRolesQuery();
  const { data: userRoles = EMPTY_ARRAY, isLoading: loadingUserRoles, error: userRolesError } = useUserRolesQuery();
  const { data: myAssignments = EMPTY_ARRAY, isLoading: loadingMy, error: myError } = useUserKpisQuery(MINE_PARAMS);
  const { data: allocatedAssignments = EMPTY_ARRAY, isLoading: loadingAllocated, error: allocatedError } = useUserKpisQuery(MINE_PARENT_PARAMS);
  const { data: sentAssignments = EMPTY_ARRAY, isLoading: loadingSent, error: sentError } = useUserKpisQuery(SENT_PARAMS);
  const { data: kpis = EMPTY_ARRAY, isLoading: loadingKpis, error: kpiError } = useKpisQuery();
  const { data: kpiTypes = EMPTY_ARRAY, isLoading: loadingTypes, error: typeError } = useKpiTypesQuery();

  // Mutations
  const createUserKpiMutation = useCreateUserKpiMutation();
  const bulkAssignUserKpiMutation = useBulkAssignUserKpisMutation();
  const updateUserKpiMutation = useUpdateUserKpiMutation();
  const deleteUserKpiMutation = useDeleteUserKpiMutation();
  const bulkDeleteUserKpiMutation = useBulkDeleteUserKpisMutation();

  const loading = loadingRoles || loadingUserRoles || loadingMy || loadingAllocated || loadingSent || loadingKpis || loadingTypes;
  const error =
    rolesError?.response?.data?.message ||
    userRolesError?.response?.data?.message ||
    myError?.response?.data?.message ||
    allocatedError?.response?.data?.message ||
    sentError?.response?.data?.message ||
    kpiError?.response?.data?.message ||
    typeError?.response?.data?.message ||
    '';

  const typeById = useMemo(() => new Map(kpiTypes.map((type) => [type.Id, type])), [kpiTypes]);
  const currentUserId = String(authUser?.id || authUser?.Id || '');

  const childrenByParent = useMemo(() => {
    const map = new Map();
    kpiTypes.forEach((type) => {
      const key = type.ParentKPIID || '__root__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(type);
    });
    return map;
  }, [kpiTypes]);

  const buildCode = (kpiTypeId) => {
    const lineage = [];
    let current = typeById.get(kpiTypeId);

    while (current) {
      lineage.unshift(current);
      current = current.ParentKPIID ? typeById.get(current.ParentKPIID) : null;
    }

    const parts = lineage.map((node) => {
      const siblings = childrenByParent.get(node.ParentKPIID || '__root__') || [];
      return siblings.findIndex((sibling) => sibling.Id === node.Id) + 1;
    });

    return parts.join('.');
  };

  const kpiRows = useMemo(
    () =>
      kpis
        .map((kpi) => {
          const leaf = typeById.get(kpi.KPITypeId);
          const subTheme = leaf?.ParentKPIID ? typeById.get(leaf.ParentKPIID) : null;
          const theme = subTheme?.ParentKPIID ? typeById.get(subTheme.ParentKPIID) : null;
          const subThemeCode = subTheme?.Id ? buildCode(subTheme.Id) : '';
          const sequentialRank = (() => {
            if (!subTheme?.Id) return null;
            const siblings = kpis
              .filter((item) => {
                const itemLeaf = typeById.get(item.KPITypeId);
                return String(itemLeaf?.ParentKPIID || '') === String(subTheme.Id);
              })
              .sort((left, right) => {
                const leftTime = new Date(left.CreatedAt || 0).getTime();
                const rightTime = new Date(right.CreatedAt || 0).getTime();
                if (leftTime !== rightTime) return leftTime - rightTime;
                return String(left.Id || '').localeCompare(String(right.Id || ''));
              });

            return siblings.findIndex((item) => item.Id === kpi.Id) + 1;
          })();

          return {
            id: kpi.Id,
            no: subThemeCode && sequentialRank ? `${subThemeCode}.${sequentialRank}` : buildCode(kpi.KPITypeId),
            kpi: leaf?.KPIName || kpi.KPIType?.KPIName || '—',
            theme: theme?.KPIName || '—',
            subTheme: subTheme?.KPIName || '—',
            unit: kpi.Unit?.Code || kpi.Unit?.Name || '—',
            weight: formatValue(kpi.Weight),
            baseline: formatValue(kpi.Baseline),
            target: formatValue(kpi.Target),
            baselineValue: parseNumericValue(kpi.Baseline),
            targetValue: parseNumericValue(kpi.Target),
            remark: kpi.Remark || kpi.Description || '—',
          };
        })
        .sort((left, right) => compareCodes(left.no, right.no)),
    [kpis, typeById, childrenByParent]
  );

  const kpiRowById = useMemo(() => new Map(kpiRows.map((row) => [row.id, row])), [kpiRows]);

  const allocatedKpiRows = useMemo(() => {
    return allocatedAssignments
      .map((assignment) => {
        const row = kpiRowById.get(assignment.KPIId);
        if (!row) return null;

        return {
          ...row,
          baseline: formatValue(assignment.Baseline ?? row.baseline),
          target: formatValue(assignment.AssignedTarget ?? row.target),
          baselineValue: parseNumericValue(assignment.Baseline ?? row.baselineValue),
          targetValue: parseNumericValue(assignment.AssignedTarget ?? row.targetValue),
          remark: assignment.Remark || row.remark,
        };
      })
      .filter(Boolean)
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [allocatedAssignments, kpiRowById]);

  const activeUserRoles = useMemo(() => userRoles.filter(isActiveAssignment), [userRoles]);

  const childOfficeRoles = useMemo(() => {
    const childRoles = roles.filter((role) => String(role.ParentRoleId || '') === currentRoleId);

    const childRoleIdsWithUsers = new Set(
      activeUserRoles.map((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '')).filter(Boolean)
    );

    return childRoles.filter((role) => childRoleIdsWithUsers.has(String(role.Id)));
  }, [roles, currentRoleId, activeUserRoles]);

  const activeChildUserRoles = useMemo(() => {
    const childRoleIds = new Set(childOfficeRoles.map((role) => String(role.Id)));
    return activeUserRoles.filter((assignment) => childRoleIds.has(String(assignment?.RoleId || assignment?.Role?.Id || '')));
  }, [activeUserRoles, childOfficeRoles]);

  const activeChildRoleByUserId = useMemo(() => {
    const map = new Map();
    activeChildUserRoles.forEach((assignment) => {
      const userId = String(assignment?.UserId || '');
      if (!userId || map.has(userId)) return;

      const roleId = String(assignment?.RoleId || assignment?.Role?.Id || '');
      const role = roles.find((item) => String(item.Id) === roleId);
      map.set(userId, {
        roleId,
        roleName: role?.RoleName || assignment?.Role?.RoleName || 'Unknown Role',
      });
    });
    return map;
  }, [activeChildUserRoles, roles]);

  const officeOptions = useMemo(() => childOfficeRoles.map((role) => ({ id: role.Id, label: role.RoleName || 'Unnamed Unit' })), [childOfficeRoles]);

  const currentRoleOption = useMemo(
    () => ({
      id: currentRoleId,
      label: authUser?.roleName || authUser?.role || 'Current Role',
    }),
    [currentRoleId, authUser?.roleName, authUser?.role]
  );

  const currentRole = useMemo(() => {
    const activeUserRole = activeUserRoles.find((assignment) => String(assignment?.UserId || '') === currentUserId);
    const activeRoleId = String(activeUserRole?.RoleId || activeUserRole?.Role?.Id || currentRoleId || '');

    const roleById = roles.find((role) => String(role.Id) === activeRoleId);
    if (roleById) return roleById;

    const authRoleName = String(authUser?.roleName || authUser?.role || '')
      .trim()
      .toLowerCase();
    if (!authRoleName) return null;

    return (
      roles.find(
        (role) =>
          String(role.RoleName || '')
            .trim()
            .toLowerCase() === authRoleName
      ) || null
    );
  }, [roles, activeUserRoles, currentUserId, currentRoleId, authUser?.roleName, authUser?.role]);

  const hasParentRole = Boolean(currentRole?.ParentRoleId);
  const isExtraMeasureRole = Boolean(currentRole?.HasExtraMeasures);

  const canCascadeKpis = useMemo(
    () =>
      permissionUtils.hasPermission(authUser?.permissions || [], [
        permissionUtils.permissionKey('create', 'KPI Allocation'),
        permissionUtils.permissionKey('view', 'KPI Allocation'),
      ]),
    [authUser?.permissions]
  );

  const canViewKpiTab = useMemo(
    () =>
      permissionUtils.hasPermission(authUser?.permissions || [], [
        permissionUtils.permissionKey('view', 'KPI Allocation'),
        permissionUtils.permissionKey('view', 'Assigned KPI'),
        permissionUtils.permissionKey('create', 'KPI Allocation'),
      ]),
    [authUser?.permissions]
  );

  const canAssignKpiTab = useMemo(
    () => permissionUtils.hasPermission(authUser?.permissions || [], permissionUtils.permissionKey('create', 'KPI Allocation')),
    [authUser?.permissions]
  );

  const canViewSentKpiTab = useMemo(
    () =>
      permissionUtils.hasPermission(authUser?.permissions || [], [
        permissionUtils.permissionKey('view', 'KPI Allocation'),
        permissionUtils.permissionKey('edit', 'KPI Allocation'),
        permissionUtils.permissionKey('delete', 'KPI Allocation'),
      ]),
    [authUser?.permissions]
  );

  const canViewHomeOfficeTab = useMemo(
    () =>
      permissionUtils.hasPermission(authUser?.permissions || [], [
        permissionUtils.permissionKey('view', 'KPI Allocation'),
        permissionUtils.permissionKey('create', 'KPI Allocation'),
      ]),
    [authUser?.permissions]
  );

  const canManageSentAssignments = useMemo(
    () =>
      permissionUtils.hasPermission(authUser?.permissions || [], [
        permissionUtils.permissionKey('edit', 'KPI Allocation'),
        permissionUtils.permissionKey('delete', 'KPI Allocation'),
        permissionUtils.permissionKey('create', 'KPI Allocation'),
      ]),
    [authUser?.permissions]
  );

  const canManageHomeOfficeAssignments = canManageSentAssignments;

  const availableTabs = useMemo(
    () =>
      [
        {
          key: 'view',
          label: hasParentRole ? 'Assigned KPI' : 'Registered KPIs',
          enabled: canViewKpiTab,
        },
        {
          key: 'assign',
          label: 'Assign KPI',
          enabled: canAssignKpiTab,
        },
        {
          key: 'sent',
          label: 'Sent KPI Tracker',
          enabled: canViewSentKpiTab,
        },
        {
          key: 'home-office',
          label: 'Home Office Kpi',
          enabled: canViewHomeOfficeTab,
        },
      ].filter((tab) => tab.enabled),
    [hasParentRole, canViewKpiTab, canAssignKpiTab, canViewSentKpiTab, canViewHomeOfficeTab]
  );

  const sourceKpiRows = useMemo(() => (hasParentRole ? allocatedKpiRows : kpiRows), [hasParentRole, allocatedKpiRows, kpiRows]);

  const allThemes = useMemo(() => [...new Set(sourceKpiRows.map((row) => row.theme).filter((theme) => theme && theme !== '—'))], [sourceKpiRows]);

  const subThemeOptions = useMemo(
    () => [
      ...new Set(
        sourceKpiRows
          .filter((row) => selectedTheme.length === 0 || selectedTheme.includes(row.theme))
          .map((row) => row.subTheme)
          .filter((subTheme) => subTheme && subTheme !== '—')
      ),
    ],
    [sourceKpiRows, selectedTheme]
  );

  const kpiOptionsByTheme = useMemo(
    () =>
      sourceKpiRows
        .filter(
          (row) =>
            (selectedTheme.length === 0 || selectedTheme.includes(row.theme)) &&
            (selectedSubTheme.length === 0 || selectedSubTheme.includes(row.subTheme))
        )
        .map((row) => ({ id: row.id, label: `${row.no}: ${row.kpi} (${row.unit}, Weight: ${row.weight})` }))
        .filter((item, index, items) => items.findIndex((entry) => entry.id === item.id) === index),
    [sourceKpiRows, selectedTheme, selectedSubTheme]
  );

  const filteredKpis = useMemo(
    () =>
      sourceKpiRows.filter((row) => {
        const matchesSearch = `${row.kpi} ${row.remark}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTheme = themeFilter === 'all' || row.theme === themeFilter;
        return matchesSearch && matchesTheme;
      }),
    [sourceKpiRows, searchTerm, themeFilter]
  );

  const selectedKpiRecords = useMemo(
    () =>
      sourceKpiRows.filter(
        (row) =>
          selectedKpi.includes(row.id) &&
          (selectedTheme.length === 0 || selectedTheme.includes(row.theme)) &&
          (selectedSubTheme.length === 0 || selectedSubTheme.includes(row.subTheme))
      ),
    [sourceKpiRows, selectedKpi, selectedTheme, selectedSubTheme]
  );

  const assignmentPreview = useMemo(() => {
    return selectedKpiRecords.map((record) => {
      const options = kpiAssignmentOptions[record.id] || getDefaultAssignmentOption();
      const targetRoleIds = new Set(selectedOffice.map((id) => String(id)));

      const targetRoleIdsArray = [...targetRoleIds];
      const receiverCount = targetRoleIds.size;
      const parentTarget = parseNumericValue(record.targetValue ?? record.target);
      const customTargetsForReceivers = targetRoleIdsArray.reduce((accumulator, roleId) => {
        const rawValue = options?.customTargets?.[roleId];
        if (rawValue === '' || rawValue === null || rawValue === undefined) return accumulator;

        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric) || numeric < 0) return accumulator;
        accumulator[roleId] = numeric;
        return accumulator;
      }, {});

      const customRoleIds = Object.keys(customTargetsForReceivers);
      const hasCustomAllocation = customRoleIds.length > 0;
      const customAllocatedTotal = customRoleIds.reduce((sum, roleId) => sum + Number(customTargetsForReceivers[roleId] || 0), 0);
      const rolesWithoutCustomTargets = targetRoleIdsArray.filter((roleId) => customTargetsForReceivers[roleId] === undefined);
      const distributedTarget =
        parentTarget === null
          ? null
          : hasCustomAllocation
            ? rolesWithoutCustomTargets.length > 0
              ? Number((Math.max(parentTarget - customAllocatedTotal, 0) / rolesWithoutCustomTargets.length).toFixed(2))
              : 0
            : options.targetIndividual
              ? parentTarget
              : receiverCount > 0
                ? Number((parentTarget / receiverCount).toFixed(2))
                : null;

      const roleTargets = targetRoleIdsArray.reduce((accumulator, roleId) => {
        if (parentTarget === null) {
          accumulator[roleId] = null;
          return accumulator;
        }

        if (hasCustomAllocation) {
          accumulator[roleId] = customTargetsForReceivers[roleId] !== undefined ? customTargetsForReceivers[roleId] : Number(distributedTarget || 0);
          return accumulator;
        }

        accumulator[roleId] = distributedTarget;
        return accumulator;
      }, {});

      return {
        ...record,
        includeCurrentRole: Boolean(options.includeCurrentRole),
        isTargetIndividual: Boolean(options.targetIndividual),
        targetRoleIds: targetRoleIdsArray,
        receiverCount,
        distributedTarget,
        roleTargets,
        hasCustomAllocation,
        customAllocatedTotal,
        remainingAfterCustom: parentTarget === null ? null : Number((parentTarget - customAllocatedTotal).toFixed(2)),
      };
    });
  }, [selectedKpiRecords, kpiAssignmentOptions, selectedOffice, currentRoleOption]);

  const roleLabelById = useMemo(() => {
    const map = new Map();
    officeOptions.forEach((option) => {
      map.set(String(option.id), option.label || 'Unnamed Office');
    });

    if (currentRoleOption?.id) {
      map.set(String(currentRoleOption.id), `${currentRoleOption.label} (Current Office)`);
    }

    return map;
  }, [officeOptions, currentRoleOption]);

  const customModalKpiRecord = useMemo(() => {
    if (!customTargetModalState.kpiId) return null;
    return assignmentPreview.find((record) => String(record.id) === String(customTargetModalState.kpiId)) || null;
  }, [assignmentPreview, customTargetModalState.kpiId]);

  const customModalOffices = useMemo(() => {
    if (!customModalKpiRecord) return [];

    return customModalKpiRecord.targetRoleIds.map((roleId) => ({
      key: String(roleId),
      label: roleLabelById.get(String(roleId)) || `Office ${roleId}`,
    }));
  }, [customModalKpiRecord, roleLabelById]);

  const sentToChildrenRows = useMemo(() => {
    const currentUserId = String(authUser?.id || authUser?.Id || '');

    const grouped = new Map();

    sentAssignments
      .filter((assignment) => String(assignment?.CreatedBy || '') === currentUserId)
      .forEach((assignment) => {
        const userId = String(assignment?.UserId || assignment?.User?.Id || '');
        const roleInfo = activeChildRoleByUserId.get(userId);
        if (!roleInfo) return;

        const kpiMeta = kpiRowById.get(assignment?.KPIId);
        const userName =
          assignment?.User?.UserName ||
          [assignment?.User?.FirstName, assignment?.User?.FatherName, assignment?.User?.GrandFatherName].filter(Boolean).join(' ') ||
          assignment?.User?.Email ||
          'Unknown User';

        const key = `${roleInfo.roleId}-${userId}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            roleName: roleInfo.roleName,
            userName,
            roleId: roleInfo.roleId,
            userId,
            kpis: [],
          });
        }

        grouped.get(key).kpis.push({
          assignmentId: assignment.Id,
          kpiId: assignment.KPIId,
          label: kpiMeta ? `${kpiMeta.no} - ${kpiMeta.kpi}` : `KPI ${assignment.KPIId}`,
          baseline: formatValue(assignment.Baseline),
          target: formatValue(assignment.AssignedTarget),
          rawBaseline: assignment.Baseline ?? '',
          rawTarget: assignment.AssignedTarget ?? '',
          remark: assignment.Remark || '',
        });
      });

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        kpis: row.kpis.sort((left, right) => String(left.label).localeCompare(String(right.label))),
      }))
      .sort((left, right) => {
        const byRole = String(left.roleName).localeCompare(String(right.roleName));
        if (byRole !== 0) return byRole;
        return String(left.userName).localeCompare(String(right.userName));
      });
  }, [sentAssignments, authUser?.id, authUser?.Id, activeChildRoleByUserId, kpiRowById]);

  const homeOfficeKpiRows = useMemo(() => {
    const currentUserId = String(authUser?.Id || authUser?.id || '');

    // Deduplicate and combine my own assignments and those from parent
    const assignmentById = new Map();
    [...myAssignments, ...allocatedAssignments].forEach((assignment) => {
      if (!assignment?.Id) return;
      if (!assignmentById.has(assignment.Id)) {
        assignmentById.set(assignment.Id, assignment);
      }
    });

    const combinedAssignments = [...assignmentById.values()];

    // Identify KPIs that have been delegated (sent to others)
    const delegatedKpiKeys = new Set(
      sentAssignments.filter((a) => String(a.UserId) !== currentUserId).map((a) => `${a.KPIId}::${(a.Name || '').trim()}::${(a.Remark || '').trim()}`)
    );

    const activePerformanceAssignments = combinedAssignments.filter((assignment) => {
      const currentUserId = String(authUser?.Id || authUser?.id || '');
      const creatorId = String(assignment?.CreatedBy || '');

      // 1. Visibility: Show if someone else created it OR explicitly activated for home office
      const isVisible = creatorId !== currentUserId || !!assignment?.IncludeCurrentOffice;
      if (!isVisible) return false;

      // 2. Delegation: Hide if the user has assigned this same KPI to a child role
      const assignmentKey = `${assignment.KPIId}::${(assignment.Name || '').trim()}::${(assignment.Remark || '').trim()}`;
      if (delegatedKpiKeys.has(assignmentKey)) {
        return false;
      }

      return true;
    });

    return activePerformanceAssignments
      .map((assignment) => {
        const kpiMeta = kpiRowById.get(assignment.KPIId);
        if (!kpiMeta) return null;

        return {
          assignmentId: assignment.Id,
          no: kpiMeta.no,
          kpi: assignment.Name || kpiMeta.kpi,
          theme: kpiMeta.theme,
          subTheme: kpiMeta.subTheme,
          baseline: formatValue(assignment.Baseline ?? kpiMeta.baseline),
          target: formatValue(assignment.AssignedTarget ?? kpiMeta.target),
          rawBaseline: assignment.Baseline ?? kpiMeta.baselineValue,
          rawTarget: assignment.AssignedTarget ?? kpiMeta.targetValue,
          remark: assignment.Remark || kpiMeta.remark,
        };
      })
      .filter(Boolean)
      .sort((left, right) => compareCodes(left.no, right.no));
  }, [myAssignments, allocatedAssignments, sentAssignments, authUser, kpiRowById]);

  const handleUnallocateHomeOfficeKpi = async (assignmentId, kpiName) => {
    setConfirmModal({
      open: true,
      title: 'Unallocate Home Office KPI',
      message: `Are you sure you want to unallocate "${kpiName}" from your home office? It will be moved back to your Assigned KPIs list.`,
      onConfirm: () => {
        updateUserKpiMutation.mutate(
          {
            id: assignmentId,
            data: { IncludeCurrentOffice: false },
          },
          {
            onSuccess: () => {
              notify('Home office KPI unallocated successfully and moved to Assigned KPI.', 'success');
              emitReportDataChanged();
            },
            onError: (err) => {
              notify(err?.response?.data?.message || 'Failed to unallocate home office KPI.', 'error');
            },
          }
        );
      },
    });
  };

  const startEditingAssignment = (kpiItem) => {
    setEditingAssignmentId(kpiItem.assignmentId);
    setEditForm({
      baseline: kpiItem.rawBaseline === null || kpiItem.rawBaseline === undefined ? '' : String(kpiItem.rawBaseline),
      target: kpiItem.rawTarget === null || kpiItem.rawTarget === undefined ? '' : String(kpiItem.rawTarget),
      remark: kpiItem.remark || '',
    });
  };

  const cancelEditingAssignment = () => {
    setEditingAssignmentId(null);
    setEditForm({ baseline: '', target: '', remark: '' });
  };

  const handleUpdateSentAssignment = async (assignmentId) => {
    const payload = {
      Baseline: editForm.baseline === '' ? null : Number(editForm.baseline),
      AssignedTarget: editForm.target === '' ? null : Number(editForm.target),
      Remark: editForm.remark?.trim() || null,
    };

    setSavingAssignmentId(assignmentId);
    updateUserKpiMutation.mutate(
      {
        id: assignmentId,
        data: payload,
      },
      {
        onSuccess: () => {
          notify('KPI assignment updated successfully.', 'success');
          emitReportDataChanged();
          cancelEditingAssignment();
        },
        onError: (err) => {
          notify(err?.response?.data?.message || 'Failed to update KPI assignment.', 'error');
        },
        onSettled: () => {
          setSavingAssignmentId(null);
        },
      }
    );
  };

  const handleUnallocateSentAssignment = async (assignmentId, kpiLabel) => {
    setConfirmModal({
      open: true,
      title: 'Unallocate KPI',
      message: `Are you sure you want to unallocate "${kpiLabel}"? This will permanently delete any performance results submitted for this assignment.`,
      onConfirm: () => {
        setDeletingAssignmentId(assignmentId);
        deleteUserKpiMutation.mutate(assignmentId, {
          onSuccess: () => {
            if (editingAssignmentId === assignmentId) {
              cancelEditingAssignment();
            }
            notify('KPI assignment unallocated successfully.', 'success');
            emitReportDataChanged();
          },
          onError: (err) => {
            notify(err?.response?.data?.message || 'Failed to unallocate KPI assignment.', 'error');
          },
          onSettled: () => {
            setDeletingAssignmentId(null);
          },
        });
      },
    });
  };

  const handleBulkUnallocate = (ids, label) => {
    setConfirmModal({
      open: true,
      title: 'Unallocate All KPIs',
      message: `Are you sure you want to unallocate all ${ids.length} KPIs for ${label}? This action cannot be undone and will permanently delete all associated performance results.`,
      onConfirm: () => {
        bulkDeleteUserKpiMutation.mutate(ids, {
          onSuccess: () => {
            notify(`Successfully unallocated all KPIs for ${label}.`, 'success');
            emitReportDataChanged();
          },
          onError: (err) => {
            notify(err?.response?.data?.message || 'Failed to unallocate all KPIs.', 'error');
          },
        });
      },
    });
  };

  const handleAssign = async () => {
    if (selectedKpi.length === 0) {
      notify('Please select at least one KPI.', 'warning');
      return;
    }

    if (selectedKpiRecords.length === 0) {
      notify('Invalid KPI selection.', 'warning');
      return;
    }

    const hasAnyTargetOffice = assignmentPreview.some((record) => record.targetRoleIds.length > 0);

    if (!hasAnyTargetOffice) {
      notify('Please select at least one target office.', 'warning');
      return;
    }

    const assignmentBatchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null;

    const assignmentData = assignmentPreview.flatMap((kpiRecord) => {
      if (kpiRecord.targetRoleIds.length === 0) return [];

      const usersByRole = new Map();
      activeUserRoles.forEach((assignment) => {
        const roleId = String(assignment?.RoleId || assignment?.Role?.Id || '');
        if (!kpiRecord.targetRoleIds.includes(roleId)) return;

        const userId = assignment?.UserId;
        if (!userId) return;

        if (!usersByRole.has(roleId)) {
          usersByRole.set(roleId, new Set());
        }

        usersByRole.get(roleId).add(userId);
      });

      if (!usersByRole.size) return [];

      return [...usersByRole.entries()].flatMap(([roleId, userIds]) => {
        const assignedTarget = kpiRecord.roleTargets?.[roleId] ?? kpiRecord.distributedTarget;

        return [...userIds].map((userId) => ({
          KPIId: kpiRecord.id,
          UserId: userId,
          AssignedTarget: assignedTarget,
          IsTargetIndividual: kpiRecord.isTargetIndividual,
          AssignmentBatchId: assignmentBatchId,
        }));
      });
    });

    if (!assignmentData.length) {
      notify('No active users found for the selected target offices.', 'warning');
      return;
    }

    // Identify existing assignments to skip them
    const existingKeys = new Set(
      sentAssignments.filter((a) => !a.IsArchived).map((a) => `${String(a.KPIId)}::${String(a.UserId)}::${(a.Name || '').trim()}`)
    );

    // Deduplicate to prevent multiple assignments for the same user/kpi pair
    const uniqueAssignments = [];
    const seen = new Set();
    let skipCount = 0;

    assignmentData.forEach((item) => {
      const key = `${String(item.UserId)}::${String(item.KPIId)}::${(item.Name || '').trim()}`;
      if (existingKeys.has(key)) {
        skipCount += 1;
        return;
      }

      if (!seen.has(key)) {
        seen.add(key);
        uniqueAssignments.push(item);
      }
    });

    if (uniqueAssignments.length === 0 && skipCount > 0) {
      notify(`All selected users already have these KPIs assigned. No new assignments created.`, 'info');
      return;
    }

    try {
      setIsAssigning(true);
      // Use bulkAssignUserKpiMutation to allocate in a single batch API call
      await bulkAssignUserKpiMutation.mutateAsync(uniqueAssignments);

      const uniqueReceiverRoles = new Set(assignmentPreview.flatMap((record) => record.targetRoleIds));

      notify('Kpi Successfully Dispatched', 'success');

      // Immediate UI Reset
      emitReportDataChanged();
      setSelectedOffice([]);
      setSelectedTheme([]);
      setSelectedSubTheme([]);
      setSelectedKpi([]);
      setKpiAssignmentOptions({});
    } catch (err) {
      console.error('Batch assignment error:', err);
      notify(err?.response?.data?.message || 'Failed to complete some KPI allocations. Please check the Sent KPI Tracker.', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  useEffect(() => {
    if (selectedOffice.length === 0) return;
    const validIds = new Set(officeOptions.map((option) => String(option.id)));
    const filtered = selectedOffice.filter((id) => validIds.has(String(id)));
    if (filtered.length !== selectedOffice.length) {
      setSelectedOffice(filtered);
    }
  }, [officeOptions, selectedOffice]);

  useEffect(() => {
    if (selectedKpi.length === 0) {
      if (Object.keys(kpiAssignmentOptions).length > 0) {
        setKpiAssignmentOptions({});
      }
      return;
    }

    setKpiAssignmentOptions((previous) => {
      const next = {};
      selectedKpi.forEach((kpiId) => {
        const key = String(kpiId);
        next[key] = previous[key] || getDefaultAssignmentOption();
      });

      const sameLength = Object.keys(next).length === Object.keys(previous).length;
      if (sameLength && Object.keys(next).every((key) => next[key] === previous[key])) {
        return previous;
      }

      return next;
    });
  }, [selectedKpi, kpiAssignmentOptions]);

  useEffect(() => {
    if (selectedSubTheme.length === 0) return;

    const validSubThemes = new Set(subThemeOptions.map((subTheme) => String(subTheme)));
    const filtered = selectedSubTheme.filter((item) => validSubThemes.has(String(item)));

    if (filtered.length !== selectedSubTheme.length) {
      setSelectedSubTheme(filtered);
    }
  }, [selectedSubTheme, subThemeOptions]);

  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  const isReadyToAssign = selectedKpi.length > 0 && assignmentPreview.some((record) => record.targetRoleIds.length > 0);

  const openCustomTargetModal = (kpiRecord) => {
    if (!kpiRecord || kpiRecord.targetRoleIds.length === 0) {
      notify('Select at least one target office before creating custom target allocation.', 'warning');
      return;
    }

    setCustomTargetModalState({ open: true, kpiId: String(kpiRecord.id) });
  };

  const handleSaveCustomTargets = (values) => {
    if (!customTargetModalState.kpiId) return;

    setKpiAssignmentOptions((previous) => {
      const key = String(customTargetModalState.kpiId);
      const current = previous[key] || getDefaultAssignmentOption();

      return {
        ...previous,
        [key]: {
          ...current,
          customTargets: values || {},
        },
      };
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KPI Assignment</h1>
        <p className="text-sm text-muted-foreground">Assign KPIs to one-level child offices based on theme</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          {availableTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableTabs.length === 0 ? (
          <p className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
            No tab is available for your current permissions.
          </p>
        ) : null}

        {canViewKpiTab ? (
          <TabsContent value="view" className="space-y-4 mt-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-end">
              <div className="relative min-w-0 md:w-70">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search KPIs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button variant={themeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setThemeFilter('all')}>
                  All Themes
                </Button>
                {allThemes.map((theme) => (
                  <Button
                    key={theme}
                    variant={themeFilter === theme ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setThemeFilter(theme)}
                    className="text-xs"
                  >
                    {theme}
                  </Button>
                ))}
              </div>
            </div>

            <AssignedKpiList
              kpis={filteredKpis}
              emptyMessage={loading ? 'Loading KPIs...' : hasParentRole ? 'No KPI is allocated by your parent role.' : 'No registered KPIs found.'}
            />
          </TabsContent>
        ) : null}

        {canAssignKpiTab ? (
          <TabsContent value="assign" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>Assign KPI</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{selectedKpi.length || 0} KPIs</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-4">
                  <p className="text-sm font-semibold text-foreground">Selection Criteria</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sub unit</p>
                      <MultiSelect options={officeOptions} value={selectedOffice} onChange={setSelectedOffice} placeholder="Select sub unit(s)" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</p>
                      <MultiSelect
                        options={allThemes}
                        value={selectedTheme}
                        onChange={(themesSelected) => {
                          setSelectedTheme(themesSelected);
                          setSelectedSubTheme([]);
                          setSelectedKpi([]);
                        }}
                        placeholder="Select theme(s)"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sub theme</p>
                      <MultiSelect
                        options={subThemeOptions}
                        value={selectedSubTheme}
                        onChange={(subThemesSelected) => {
                          setSelectedSubTheme(subThemesSelected);
                          setSelectedKpi([]);
                        }}
                        placeholder="Select sub-theme(s)"
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KPI</p>
                      <MultiSelect options={kpiOptionsByTheme} value={selectedKpi} onChange={setSelectedKpi} placeholder="Select KPI(s)" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">KPI Details</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {assignmentPreview.length} KPIs
                    </span>
                  </div>

                  {assignmentPreview.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Select KPI(s) to preview target distribution.</p>
                  ) : (
                    <div className="space-y-3">
                      {assignmentPreview.map((kpiRecord, index) => (
                        <div key={kpiRecord.id} className="rounded-lg border border-border px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                                {index + 1}
                              </span>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KPI Name</p>
                                <p className="text-sm font-medium text-foreground">{kpiRecord.kpi}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedKpi((previous) => previous.filter((id) => id !== kpiRecord.id))}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KPI Target</p>
                            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {formatNumericPreview(kpiRecord.distributedTarget)}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`target-individual-${kpiRecord.id}`}
                                  checked={Boolean(kpiAssignmentOptions[kpiRecord.id]?.targetIndividual)}
                                  onCheckedChange={(checked) =>
                                    setKpiAssignmentOptions((previous) => ({
                                      ...previous,
                                      [kpiRecord.id]: {
                                        ...(previous[kpiRecord.id] || getDefaultAssignmentOption()),
                                        targetIndividual: Boolean(checked),
                                      },
                                    }))
                                  }
                                />
                                <label htmlFor={`target-individual-${kpiRecord.id}`} className="text-sm text-foreground cursor-pointer select-none">
                                  KPI Target individual
                                </label>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openCustomTargetModal(kpiRecord)}
                                className="h-7 px-2 text-[11px]"
                              >
                                Create custom target
                              </Button>
                            </div>
                          </div>

                          <p className="mt-2 text-xs text-muted-foreground">
                            Parent target: {formatNumericPreview(kpiRecord.targetValue)} | Receivers: {kpiRecord.receiverCount || 0} | Mode:{' '}
                            {kpiRecord.hasCustomAllocation
                              ? 'Custom allocation'
                              : kpiRecord.isTargetIndividual
                                ? 'Individual (full target)'
                                : 'Shared (divided target)'}
                          </p>
                          {kpiRecord.hasCustomAllocation ? (
                            <p className="mt-1 text-xs text-primary">
                              Custom allocated: {formatNumericPreview(kpiRecord.customAllocatedTotal)} | Remaining shared:{' '}
                              {formatNumericPreview(kpiRecord.remainingAfterCustom)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ready to Assign</p>
                      <p className="text-xs text-muted-foreground">Complete selections above to enable assignment.</p>
                      <p className="mt-1 text-xs text-primary">Each selected unit will receive the KPI target shown above.</p>
                    </div>

                    <Button onClick={handleAssign} disabled={loading || !isReadyToAssign || isAssigning}>
                      {isAssigning ? 'Assigning...' : 'Assign KPI'}
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canViewSentKpiTab ? (
          <TabsContent value="sent" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>KPIs Sent to Child Roles</CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="min-w-245">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/10">
                          <TableHead className="w-70 font-bold text-foreground border-r">Role and User</TableHead>
                          <TableHead className="w-130 font-bold text-foreground border-r">KPI Sent</TableHead>
                          <TableHead className="w-40 font-bold text-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {sentToChildrenRows.length > 0 ? (
                          sentToChildrenRows.flatMap((recipient) =>
                            recipient.kpis.map((kpiItem, kpiIndex) => {
                              const isEditing = editingAssignmentId === kpiItem.assignmentId;
                              const isSaving = savingAssignmentId === kpiItem.assignmentId;
                              const isDeleting = deletingAssignmentId === kpiItem.assignmentId;

                              return (
                                <TableRow key={kpiItem.assignmentId} className="align-top">
                                  {kpiIndex === 0 && (
                                    <TableCell rowSpan={recipient.kpis.length} className="border-r align-top w-70 bg-card/50">
                                      <div className="flex flex-col h-full justify-between py-1">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground truncate max-w-[260px]" title={recipient.roleName}>
                                            {recipient.roleName}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[260px]" title={recipient.userName}>
                                            {recipient.userName}
                                          </p>
                                        </div>
                                        {canManageSentAssignments && recipient.kpis.length > 1 && (
                                          <div className="mt-4 pt-2 border-t border-border/50">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                handleBulkUnallocate(
                                                  recipient.kpis.map((k) => k.assignmentId),
                                                  recipient.userName
                                                )
                                              }
                                              className="w-full text-[10px] h-7 border-red-200 text-red-500 hover:bg-red-50"
                                            >
                                              Unallocate All ({recipient.kpis.length})
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  )}

                                  <TableCell className="border-r align-top p-0 w-130">
                                    <div className="px-4 py-3 h-full">
                                      <p className="text-sm font-medium text-foreground truncate max-w-117.5" title={kpiItem.label}>
                                        {kpiItem.label}
                                      </p>

                                      {isEditing ? (
                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase pl-1">Baseline</label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editForm.baseline}
                                              onChange={(event) => setEditForm((previous) => ({ ...previous, baseline: event.target.value }))}
                                              placeholder="Baseline"
                                              className="h-8 text-xs"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase pl-1">Target</label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editForm.target}
                                              onChange={(event) => setEditForm((previous) => ({ ...previous, target: event.target.value }))}
                                              placeholder="Target"
                                              className="h-8 text-xs"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase pl-1">Remark</label>
                                            <Input
                                              value={editForm.remark}
                                              onChange={(event) => setEditForm((previous) => ({ ...previous, remark: event.target.value }))}
                                              placeholder="Remark"
                                              className="h-8 text-xs"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="mt-1.5 flex items-center gap-2">
                                          <p
                                            className="text-xs text-muted-foreground truncate max-w-105"
                                            title={`Baseline: ${kpiItem.baseline} | Target: ${kpiItem.target}${kpiItem.remark ? ` | Remark: ${kpiItem.remark}` : ''}`}
                                          >
                                            Baseline: {kpiItem.baseline} | Target: {kpiItem.target}
                                            {kpiItem.remark ? ` | Remark: ${kpiItem.remark}` : ''}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDetailModal({
                                                open: true,
                                                title: 'Sent KPI Details',
                                                data: {
                                                  role: recipient.roleName,
                                                  user: recipient.userName,
                                                  kpi: kpiItem.label,
                                                  baseline: kpiItem.baseline,
                                                  target: kpiItem.target,
                                                  remark: kpiItem.remark || '—',
                                                },
                                              })
                                            }
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border hover:bg-muted text-muted-foreground"
                                            aria-label="View full KPI details"
                                          >
                                            <Eye className="h-3 w-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>

                                  <TableCell className="align-top p-0 w-40">
                                    <div className="px-4 py-3 flex items-center gap-2 h-full">
                                      {isEditing ? (
                                        <>
                                          <Button
                                            size="sm"
                                            onClick={() => handleUpdateSentAssignment(kpiItem.assignmentId)}
                                            disabled={isSaving || isDeleting}
                                            className="h-8 px-3 inline-flex items-center gap-1.5"
                                          >
                                            <Save className="h-3.5 w-3.5" />
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelEditingAssignment}
                                            disabled={isSaving || isDeleting}
                                            className="h-8 px-3 inline-flex items-center gap-1.5"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                            Cancel
                                          </Button>
                                        </>
                                      ) : canManageSentAssignments ? (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditingAssignment(kpiItem)}
                                            disabled={isDeleting}
                                            className="h-8 px-3 inline-flex items-center gap-1.5"
                                          >
                                            <PencilLine className="h-3.5 w-3.5" />
                                            Edit
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleUnallocateSentAssignment(kpiItem.assignmentId, kpiItem.label)}
                                            disabled={isDeleting}
                                            className="h-8 px-3 inline-flex items-center gap-1.5 border-red-300 text-red-600 hover:bg-red-50 whitespace-nowrap"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            {isDeleting ? 'Unallocating...' : 'Unallocate'}
                                          </Button>
                                        </>
                                      ) : (
                                        <p className="text-xs text-muted-foreground italic">No actions</p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                              {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                  Loading sent KPI assignments...
                                </div>
                              ) : (
                                'No KPI has been sent to child roles/users yet.'
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canViewHomeOfficeTab ? (
          <TabsContent value="home-office" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Home Office Kpi</CardTitle>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="min-w-245">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/10">
                          <TableHead className="w-18 text-center font-bold text-foreground border-r">No.</TableHead>
                          <TableHead className="w-65 font-bold text-foreground border-r">KPI</TableHead>
                          <TableHead className="w-45 font-bold text-foreground border-r">Theme</TableHead>
                          <TableHead className="w-45 font-bold text-foreground border-r">Sub Theme</TableHead>
                          <TableHead className="w-25 text-center font-bold text-foreground border-r">Baseline</TableHead>
                          <TableHead className="w-25 text-center font-bold text-foreground border-r">Target</TableHead>
                          <TableHead className="w-55 font-bold text-foreground border-r">Remark</TableHead>
                          <TableHead className="w-37.5 font-bold text-foreground">View / Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {homeOfficeKpiRows.map((row) => (
                          <TableRow key={row.assignmentId}>
                            <TableCell className="h-12 text-center border-r text-sm font-medium">{row.no}</TableCell>
                            <TableCell className="h-12 border-r text-sm">
                              <CompactCellText value={row.kpi} maxWidth="max-w-[240px]" />
                            </TableCell>
                            <TableCell className="h-12 border-r text-sm text-muted-foreground">
                              <CompactCellText value={row.theme} maxWidth="max-w-[160px]" />
                            </TableCell>
                            <TableCell className="h-12 border-r text-sm text-muted-foreground">
                              <CompactCellText value={row.subTheme} maxWidth="max-w-[160px]" />
                            </TableCell>
                            <TableCell className="h-12 text-center border-r text-sm">{row.baseline}</TableCell>
                            <TableCell className="h-12 text-center border-r text-sm">{row.target}</TableCell>
                            <TableCell className="h-12 border-r text-sm text-muted-foreground">
                              <CompactCellText value={row.remark} maxWidth="max-w-[200px]" />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailModal({
                                      open: true,
                                      title: 'Home Office KPI Details',
                                      data: {
                                        no: row.no,
                                        kpi: row.kpi,
                                        theme: row.theme,
                                        subTheme: row.subTheme,
                                        baseline: row.baseline,
                                        target: row.target,
                                        remark: row.remark,
                                      },
                                    })
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-muted"
                                  aria-label="View full KPI info"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>

                                {canManageHomeOfficeAssignments ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUnallocateHomeOfficeKpi(row.assignmentId, row.kpi)}
                                    disabled={deletingAssignmentId === row.assignmentId}
                                    className="inline-flex items-center gap-1 border-red-300 text-red-600 hover:bg-red-50 whitespace-nowrap"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {deletingAssignmentId === row.assignmentId ? 'Unallocating...' : 'Unallocate'}
                                  </Button>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No actions</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}

                        {homeOfficeKpiRows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              {loading ? 'Loading home office KPIs...' : 'No active home office KPI is available.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={detailModal.open} onOpenChange={(open) => !open && setDetailModal({ open: false, title: '', data: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailModal.title || 'Details'}</DialogTitle>
          </DialogHeader>

          {detailModal.data ? (
            <div className="space-y-2 text-sm">
              {Object.entries(detailModal.data).map(([key, value]) => (
                <p key={key}>
                  <span className="font-semibold capitalize">{key}:</span> {String(value || '—')}
                </p>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ChildOfficesModal
        open={customTargetModalState.open}
        onOpenChange={(open) =>
          setCustomTargetModalState((previous) => ({
            open,
            kpiId: open ? previous.kpiId : null,
          }))
        }
        totalTarget={Number(customModalKpiRecord?.targetValue ?? customModalKpiRecord?.target ?? 0)}
        offices={customModalOffices}
        initialValues={customTargetModalState.kpiId ? kpiAssignmentOptions[String(customTargetModalState.kpiId)]?.customTargets || {} : {}}
        onSave={handleSaveCustomTargets}
        notify={notify}
      />

      <Dialog open={confirmModal.open} onOpenChange={(open) => !open && setConfirmModal((prev) => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className={confirmModal.isDestructive ? 'text-red-600' : ''}>{confirmModal.title}</DialogTitle>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">{confirmModal.message}</p>
            </div>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              variant={confirmModal.isDestructive ? 'destructive' : 'default'}
              onClick={() => {
                confirmModal.onConfirm?.();
                setConfirmModal((prev) => ({ ...prev, open: false }));
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KpiAllocationPage;
