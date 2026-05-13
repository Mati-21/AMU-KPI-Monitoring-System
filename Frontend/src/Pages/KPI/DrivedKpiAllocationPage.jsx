import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNotification } from '../../Context/NotificationContext';
import { Eye, Plus, Minus, Pencil, Trash2, UserMinus, UserX, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import Button from '../../Components/UI/Button';
import Checkbox from '../../Components/UI/Checkbox';
import CustomSelect from '../../Components/UI/CustomSelect';
import MultiSelect from '../../Components/UI/MultiSelect';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../Components/UI/dialog';
import { Input } from '../../Components/UI/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../Components/UI/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../Components/UI/Table';
import { api } from '../../api/axios';
import permissionUtils, { hasPermission } from '../../lib/permissionUtils';
import ChildOfficesModal from '../../Components/KPI/ChildOfficesModal';
import { useRolesQuery } from '../../Hooks/Queries/useRoles';
import { useUserRolesQuery } from '../../Hooks/Queries/useUsers';
import { 
  useKpisQuery, 
  useUserKpisQuery,
  useCreateUserKpiMutation,
  useUpdateUserKpiMutation,
  useDeleteUserKpiMutation
} from '../../Hooks/Queries/useKpis';

const tableHeaders = ['Parent KPI', 'Drived Kpi', 'Unit', 'Baseline', 'Target', 'Remark'];

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'null';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric.toString();
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const selectClassName = 'h-10 w-full rounded border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary';

const createDrivenKpiRow = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  value: '',
});

const EMPTY_ARRAY = [];
const SENT_DERIVED_PARAMS = { scope: 'sent', isDerived: 'true' };
const MINE_PARAMS = { scope: 'mine' };

const DrivedKpiAllocationPage = () => {
  const authUser = useSelector((state) => state.auth?.user);
  const currentRoleId = String(authUser?.roleId || authUser?.RoleId || authUser?.currentRole?.Id || authUser?.currentRole?.RoleId || '');

  const hasExtraMeasures = Boolean(
    authUser?.hasExtraMeasures || authUser?.HasExtraMeasures || authUser?.currentRole?.HasExtraMeasures || authUser?.currentRole?.hasExtraMeasures
  );
  const userPermissions = authUser?.currentRole?.Permissions || authUser?.permissions || [];
  const [refreshToken, setRefreshToken] = useState(0);

  const canCreate =
    hasPermission(userPermissions, [
      permissionUtils.permissionKey('create', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('manage', 'Drived KPI Allocation'),
    ]) || hasExtraMeasures;
  const canAssign =
    hasPermission(userPermissions, [
      permissionUtils.permissionKey('assign', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('manage', 'Drived KPI Allocation'),
    ]) || hasExtraMeasures;
  const canEdit =
    hasPermission(userPermissions, [
      permissionUtils.permissionKey('edit', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('manage', 'Drived KPI Allocation'),
    ]) || hasExtraMeasures;
  const canDelete =
    hasPermission(userPermissions, [
      permissionUtils.permissionKey('delete', 'Drived KPI Allocation'),
      permissionUtils.permissionKey('manage', 'Drived KPI Allocation'),
    ]) || hasExtraMeasures;

  const [activeTab, setActiveTab] = useState('view-drived');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [includeCurrentOfficeDrafts, setIncludeCurrentOfficeDrafts] = useState({});
  const [selectedDrivedKpi, setSelectedDrivedKpi] = useState(null);
  const [drivedKpiModalMode, setDrivedKpiModalMode] = useState('view');
  const [drivedTargetDraft, setDrivedTargetDraft] = useState('');
  const [assignmentTargetDrafts, setAssignmentTargetDrafts] = useState({});
  const [targetIndividualDrafts, setTargetIndividualDrafts] = useState({});
  const [customTargetDrafts, setCustomTargetDrafts] = useState({});
  const [customTargetModalState, setCustomTargetModalState] = useState({ open: false, kpiId: null });
  const [customTargetEditors, setCustomTargetEditors] = useState({});
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingDrivedKpi, setDeletingDrivedKpi] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [savingDrivedTarget, setSavingDrivedTarget] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Mutations
  const createUserKpiMutation = useCreateUserKpiMutation();
  const updateUserKpiMutation = useUpdateUserKpiMutation();
  const deleteUserKpiMutation = useDeleteUserKpiMutation();

  const deleting = deleteUserKpiMutation.isPending;

  // Queries
  const { data: roles = EMPTY_ARRAY, isLoading: loadingRoles, error: rolesError } = useRolesQuery();
  const { data: userRoles = EMPTY_ARRAY, isLoading: loadingUserRoles, error: userRolesError } = useUserRolesQuery();
  const { data: myAssignments = EMPTY_ARRAY, isLoading: loadingMy, error: myError } = useUserKpisQuery(MINE_PARAMS);
  const { data: sentAssignments = EMPTY_ARRAY, isLoading: loadingSent, error: sentError } = useUserKpisQuery(SENT_DERIVED_PARAMS);
  const { data: kpis = EMPTY_ARRAY, isLoading: loadingKpis, error: kpiError } = useKpisQuery();

  const loadingCatalog = loadingRoles || loadingUserRoles || loadingMy || loadingSent || loadingKpis;
  const catalogError = 
    rolesError?.response?.data?.message || 
    userRolesError?.response?.data?.message || 
    myError?.response?.data?.message || 
    sentError?.response?.data?.message || 
    kpiError?.response?.data?.message || '';
  const units = []; // Placeholder for now

  const assignedKpis = useMemo(() => {
    const kpiById = new Map(kpis.map((kpi) => [String(kpi.Id), kpi]));
    return myAssignments.map((assignment) => {
      const kpi = kpiById.get(String(assignment.KPIId));
      if (!kpi) return null;
      return {
        id: assignment.Id,
        kpiId: kpi.Id,
        label: `${kpi.KPIType?.KPIName || kpi.KPIName || 'Unnamed KPI'}${kpi.Unit?.Code || kpi.Unit?.Name ? ` (${kpi.Unit?.Code || kpi.Unit?.Name})` : ''}`,
        remark: assignment.Remark || '',
        name: assignment.Name || '',
        assignedTarget: assignment.AssignedTarget ?? null,
        originalTarget: kpi.Target ?? null,
        hasDerivedRemark: !!assignment.Remark,
        unit: kpi.Unit?.Code || kpi.Unit?.Name || 'null',
        baseline: assignment.Baseline ?? kpi.Baseline ?? 'null',
        target: assignment.AssignedTarget ?? kpi.Target ?? 'null',
        isAssigned: String(assignment.CreatedBy) !== String(authUser?.Id || authUser?.id),
      };
    }).filter(Boolean);
  }, [myAssignments, kpis, authUser]);

  const mainKpiOptions = useMemo(
    () =>
      assignedKpis
        .map((item) => ({
          label: item.label,
          value: item.kpiId,
        }))
        .filter((item, index, items) => items.findIndex((entry) => String(entry.value) === String(item.value)) === index),
    [assignedKpis]
  );

  const drivedKpis = useMemo(() => {
    const myCreatedDrived = assignedKpis
      .filter((item) => item.name && !item.isAssigned)
      .map((item) => ({ ...item, mainKpiId: item.kpiId, parent: item.label, drived: item.name }));
    
    const parentAssignedDrived = assignedKpis
      .filter((item) => item.name && item.isAssigned)
      .map((item) => ({ ...item, mainKpiId: item.kpiId, parent: item.label, drived: item.name }));

    return [...myCreatedDrived, ...parentAssignedDrived].sort((a, b) => (a.parent || "").localeCompare(b.parent || ""));
  }, [assignedKpis]);

  const sentDrivedKpis = useMemo(() => {
    return sentAssignments.map((assignment) => ({
      id: assignment.Id,
      targetUser: assignment.User?.FirstName || assignment.User?.UserName || 'Unknown',
      targetRole: roles.find((r) => String(r.Id) === String(userRoles.find((ur) => ur.UserId === assignment.UserId)?.RoleId))?.RoleName || 'Target Role',
      drivedKpi: assignment.Name || assignment.Remark || 'null',
      recipients: 1,
      includeCurrentRole: assignment.IncludeCurrentOffice,
      mainKpiId: assignment.KPIId,
      unit: assignment.KPI?.Unit?.Code || 'null',
      baseline: assignment.Baseline,
      target: assignment.AssignedTarget,
    }));
  }, [sentAssignments, roles, userRoles]);

  const canModifyAssignedTarget = canEdit || canAssign || canCreate || hasExtraMeasures;

  const openDrivedKpiModal = (row, mode = 'view') => {
    setSelectedDrivedKpi(row);
    setDrivedKpiModalMode(mode);
    setDrivedTargetDraft(String(row?.assignedTarget ?? row?.target ?? ''));
  };

  const closeDrivedKpiModal = () => {
    setSelectedDrivedKpi(null);
    setDrivedKpiModalMode('view');
    setDrivedTargetDraft('');
    setSavingDrivedTarget(false);
  };

  const handleSaveDrivedTarget = async () => {
    if (!selectedDrivedKpi?.id) return;

    setSavingDrivedTarget(true);
    updateUserKpiMutation.mutate({
      id: selectedDrivedKpi.id,
      data: { AssignedTarget: parseNumericValue(drivedTargetDraft) }
    }, {
      onSuccess: () => {
        notify('Drived KPI target updated successfully.', 'success');
        closeDrivedKpiModal();
      },
      onError: (err) => {
        notify(err?.response?.data?.message || 'Failed to update Drived KPI target.', 'error');
      },
      onSettled: () => {
        setSavingDrivedTarget(false);
      }
    });
  };

  // Restore handleAssignDrivedKpi
  const handleAssignDrivedKpi = async () => {
    const targetRoleId = String(formState.staff || '');
    const selectedDrivenKpiIds = Array.isArray(formState.drivedKpiAssignment)
      ? formState.drivedKpiAssignment.map((value) => String(value || '')).filter(Boolean)
      : [];

    if (!targetRoleId) {
      notify('Please select a target role before assigning.', 'warning');
      return;
    }

    if (selectedDrivenKpiIds.length === 0) {
      notify('Please select at least one Drived KPI to assign.', 'warning');
      return;
    }

    try {
      setAssigning(true);
      const selectedDrivenKpis = drivedKpis.filter((item) => selectedDrivenKpiIds.includes(String(item.id)));
      if (selectedDrivenKpis.length === 0) {
        notify('The selected Drived KPI items could not be found.', 'error');
        return;
      }

      const kpisWithRecipients = selectedDrivenKpis.map(kpi => ({
        kpi,
        recipientUserIds: getRecipientUserIdsForKpi(kpi.id)
      })).filter(item => item.recipientUserIds.length > 0);

      if (kpisWithRecipients.length === 0) {
        notify(isDistributable ? 'No active users were found in the selected role(s).' : 'Please select at least one target user.', 'warning');
        return;
      }

      const assignmentBatchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null;

      const assignmentBatchData = kpisWithRecipients.flatMap(({ kpi: selectedDrivenKpi, recipientUserIds }) => {
        const baselineNumber = Number(selectedDrivenKpi.baseline);
        const targetDraft = assignmentTargetDrafts[String(selectedDrivenKpi.id)];
        const targetNumber = Number(targetDraft ?? selectedDrivenKpi.assignedTarget ?? selectedDrivenKpi.target);
        const remarkText = Array.isArray(selectedDrivenKpi.drived) ? selectedDrivenKpi.drived.join(' | ') : selectedDrivenKpi.drived;
        const kpiIncludeCurrentRole = !!includeCurrentOfficeDrafts[String(selectedDrivenKpi.id)];

        const perUserTarget =
          targetIndividualDrafts[String(selectedDrivenKpi.id)]
            ? targetNumber
            : recipientUserIds.length > 0
              ? Number((targetNumber / recipientUserIds.length).toFixed(2))
              : targetNumber;

        return recipientUserIds.map((userId) => {
          const customTarget = customTargetDrafts[String(selectedDrivenKpi.id)]?.[userId];
          const finalTarget = customTarget !== undefined ? Number(customTarget) : perUserTarget;

          return {
            KPIId: selectedDrivenKpi.mainKpiId,
            UserId: userId,
            Baseline: (isDistributable && formState.distributionMethod === 'equal') ? 0 : (Number.isFinite(baselineNumber) ? baselineNumber : null),
            AssignedTarget: Number.isFinite(finalTarget) ? finalTarget : null,
            IsTargetIndividual: !!targetIndividualDrafts[String(selectedDrivenKpi.id)],
            IncludeCurrentOffice: kpiIncludeCurrentRole && userRoles.some(ur => String(ur.UserId) === String(userId) && String(ur.RoleId) === String(currentRoleId)),
            AssignmentBatchId: assignmentBatchId,
            Name: selectedDrivenKpi.name || remarkText,
            Remark: '',
          };
        });
      });

      await Promise.all(assignmentBatchData.map(data => createUserKpiMutation.mutateAsync(data)));

      const totalUniqueRecipients = new Set(kpisWithRecipients.flatMap(item => item.recipientUserIds)).size;
      notify(`Assigned ${selectedDrivenKpis.length} Drived KPI item(s) to ${totalUniqueRecipients} user(s).`, 'success');
      
      setFormState((previous) => ({
        ...previous,
        staff: '',
        drivedKpiAssignment: [],
      }));
      setAssignmentTargetDrafts({});
      setCustomTargetEditors({});
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to assign Drived KPI.', 'error');
    } finally {
      setAssigning(false);
    }
  };
  const [formState, setFormState] = useState({
    mainKpi: '',
    unit: '',
    chair: '',
    baseline: '',
    target: '',
    drivedKpis: [createDrivenKpiRow()],
    staff: '',
    drivedKpiAssignment: [],
    distributionMethod: 'equal',
    selectedUserIds: [],
    remark: '',
  });
  const selectedMainKpiLabel = mainKpiOptions.find((item) => String(item.value) === String(formState.mainKpi))?.label || '';

  const selectedDrivedKpiRecords = useMemo(
    () => drivedKpis.filter((item) => formState.drivedKpiAssignment.includes(String(item.id))),
    [drivedKpis, formState.drivedKpiAssignment]
  );

  const selectedDrivedRecipientCount = useMemo(() => {
    const targetRoleId = String(formState.staff || '');
    if (!targetRoleId) return 0;

    const targetRoleIds = new Set([targetRoleId]);
    const kpiIncludeCurrentRole = includeCurrentOfficeDrafts[String(formState.drivedKpiAssignment[0])] ?? false;
    if (kpiIncludeCurrentRole && currentRoleId) {
      targetRoleIds.add(String(currentRoleId));
    }

    return userRoles.filter(
      (assignment) => targetRoleIds.has(String(assignment?.RoleId || assignment?.Role?.Id || '')) && (assignment?.UserId || assignment?.User?.Id)
    ).length;
  }, [formState.staff, includeCurrentOfficeDrafts, currentRoleId, userRoles, formState.drivedKpiAssignment]);

  const selectedTargetRole = useMemo(() => roles.find((r) => String(r.Id) === String(formState.staff)), [roles, formState.staff]);
  const isDistributable = selectedTargetRole ? Boolean(selectedTargetRole.IsDistributable) : true;

  const usersInSelectedRole = useMemo(() => {
    const roleId = String(formState.staff || '');
    if (!roleId) return [];
    return userRoles
      .filter((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '') === roleId)
      .map((assignment) => ({
        id: assignment?.UserId || assignment?.User?.Id,
        name:
          assignment?.User?.FirstName ||
          [assignment?.User?.FirstName, assignment?.User?.FatherName].filter(Boolean).join(' ') ||
          assignment?.User?.UserName ||
          'Unknown User',
      }))
      .filter((u, i, a) => u.id && a.findIndex((entry) => entry.id === u.id) === i);
  }, [formState.staff, userRoles]);

  const getRecipientUserIdsForKpi = (kpiId) => {
    const targetRoleId = String(formState.staff || '');
    const kpiIncludeCurrentRole = !!includeCurrentOfficeDrafts[String(kpiId)];
    
    if (!targetRoleId && !kpiIncludeCurrentRole) return [];
    
    const targetRoleIds = new Set();
    if (targetRoleId) targetRoleIds.add(targetRoleId);
    if (kpiIncludeCurrentRole && currentRoleId) targetRoleIds.add(String(currentRoleId));

    if (isDistributable) {
      return [
        ...new Set(
          userRoles
            .filter((assignment) => targetRoleIds.has(String(assignment?.RoleId || assignment?.Role?.Id || '')))
            .map((assignment) => assignment?.UserId || assignment?.User?.Id)
            .filter(Boolean)
        ),
      ];
    } else {
      // For non-distributable, we still might want to include the current user if includeCurrentRole is checked
      const users = [...formState.selectedUserIds];
      if (kpiIncludeCurrentRole && authUser?.id) {
        users.push(String(authUser.id));
      }
      return [...new Set(users)];
    }
  };

  const hasAnyRecipients = useMemo(() => {
    return formState.drivedKpiAssignment.some(kpiId => getRecipientUserIdsForKpi(kpiId).length > 0);
  }, [formState.drivedKpiAssignment, includeCurrentOfficeDrafts, formState.staff, formState.selectedUserIds, isDistributable, userRoles, currentRoleId, authUser?.id]);

  const handleRemoveSelectedDrivedKpi = (itemId) => {
    const itemKey = String(itemId);

    setFormState((previous) => ({
      ...previous,
      drivedKpiAssignment: previous.drivedKpiAssignment.filter((value) => String(value || '') !== itemKey),
    }));

    setAssignmentTargetDrafts((previous) => {
      const next = { ...previous };
      delete next[itemKey];
      return next;
    });

    setCustomTargetEditors((previous) => {
      const next = { ...previous };
      delete next[itemKey];
      return next;
    });
  };

  const toggleCustomTargetEditor = (itemId) => {
    const itemKey = String(itemId);
    setCustomTargetEditors((previous) => ({
      ...previous,
      [itemKey]: !previous[itemKey],
    }));
  };

  useEffect(() => {
    setAssignmentTargetDrafts((previous) => {
      const next = { ...previous };
      const selectedIds = new Set(formState.drivedKpiAssignment.map((value) => String(value || '')).filter(Boolean));

      Object.keys(next).forEach((key) => {
        if (!selectedIds.has(String(key))) {
          delete next[key];
        }
      });

      selectedDrivedKpiRecords.forEach((item) => {
        const itemId = String(item.id);
        if (next[itemId] === undefined) {
          next[itemId] = String(item.assignedTarget ?? item.target ?? '');
        }
      });

      return next;
    });
  }, [selectedDrivedKpiRecords, formState.drivedKpiAssignment]);



  const childRoleOptions = useMemo(() => {
    if (!currentRoleId) return [];

    const childRoles = roles.filter((role) => String(role.ParentRoleId || '') === currentRoleId);
    const registeredChildRoleIds = new Set(userRoles.map((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '')).filter(Boolean));

    return childRoles
      .filter((role) => registeredChildRoleIds.has(String(role.Id)))
      .map((role) => ({ id: role.Id, label: role.RoleName || 'Unnamed Role' }));
  }, [currentRoleId, roles, userRoles]);

  const { notify } = useNotification();
  const handleDrivenKpiChange = (rowId, value) => {
    setFormState((previous) => ({
      ...previous,
      drivedKpis: previous.drivedKpis.map((item) => (item.id === rowId ? { ...item, value } : item)),
    }));
  };

  const handleAddDrivenKpi = () => {
    setFormState((previous) => ({
      ...previous,
      drivedKpis: [...previous.drivedKpis, createDrivenKpiRow()],
    }));
  };
  const handleRemoveDrivenKpi = (rowId) => {
    setFormState((previous) => {
      if (previous.drivedKpis.length <= 1) return previous;
      return {
        ...previous,
        drivedKpis: previous.drivedKpis.filter((item) => item.id !== rowId),
      };
    });
  };

  const handleCreateDrivedKpi = async () => {
    const selectedDrivenKpiValues = (formState.drivedKpis || []).map((d) => (d?.value || '').trim()).filter(Boolean);
    if (!formState.mainKpi || selectedDrivenKpiValues.length === 0) {
      notify('Please select a Main KPI and provide at least one Drived KPI name.', 'warning');
      return;
    }

    const remarkText = selectedDrivenKpiValues.join(' | ');

    try {
      setAssigning(true);
      await createUserKpiMutation.mutateAsync({
        KPIId: formState.mainKpi,
        UserId: authUser?.Id || authUser?.id,
        Baseline: parseNumericValue(formState.baseline),
        AssignedTarget: parseNumericValue(formState.target),
        IncludeCurrentOffice: false,
        Name: remarkText,
        Remark: formState.remark || '',
      });

      notify('Drived KPI created and saved successfully.', 'success');
      setActiveTab('view-drived');
      setFormState((previous) => ({
        ...previous,
        mainKpi: '',
        unit: '',
        chair: '',
        baseline: '',
        target: '',
        remark: '',
        drivedKpis: [createDrivenKpiRow()],
      }));
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to create Drived KPI.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          notify('The file appears to be empty.', 'warning');
          return;
        }

        console.log('Raw Excel Data:', jsonData);

        setAssigning(true);
        let successCount = 0;
        let failCount = 0;
        let noMatchCount = 0;
        let firstFailedName = '';

        for (const row of jsonData) {
          // Normalize keys: lowercase, remove spaces and underscores
          const normalizedRow = {};
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().replace(/[\s_]/g, '');
            normalizedRow[normalizedKey] = row[key];
          });

          const mainKpiName =
            normalizedRow.mainkpi || normalizedRow.kpi || normalizedRow.kpiname || normalizedRow.parentkpi || Object.values(row)[0];

          if (!firstFailedName) firstFailedName = String(mainKpiName || '');

          const baseline = normalizedRow.baseline || normalizedRow.base;
          const target = normalizedRow.target || normalizedRow.goaltarget;
          const unitName = normalizedRow.unit || normalizedRow.unitname || normalizedRow.measure;
          const derivedKpis =
            normalizedRow.derivedkpi ||
            normalizedRow.drivedkpi ||
            normalizedRow.derivedkpis ||
            normalizedRow.drivedkpis ||
            normalizedRow.derived ||
            normalizedRow.drived;

          if (!mainKpiName) {
            failCount++;
            continue;
          }

          const match = mainKpiOptions.find((opt) => {
            const label = opt.label.toLowerCase().replace(/[\s\W_]/g, '');
            const search = String(mainKpiName || '')
              .toLowerCase()
              .replace(/[\s\W_]/g, '');
            return label.includes(search) || search.includes(label);
          });

          if (!match) {
            console.warn(`No match found for Main KPI: "${mainKpiName}"`);
            noMatchCount++;
            failCount++;
            continue;
          }
          
          if (firstFailedName === String(mainKpiName || '')) firstFailedName = ''; // It didn't fail matching

          // Optional Unit matching
          let targetUnitId = null;
          if (unitName) {
            const unitMatch = units.find(
              (u) =>
                (u.Code || '').toLowerCase() === String(unitName).toLowerCase() ||
                (u.Name || '').toLowerCase() === String(unitName).toLowerCase()
            );
            if (unitMatch) targetUnitId = unitMatch.Id;
          }

          const derivedValue = String(derivedKpis || '').trim();

          if (!derivedValue) {
            failCount++;
            continue;
          }

          try {
            await createUserKpiMutation.mutateAsync({
              KPIId: match.value,
              UserId: authUser?.Id || authUser?.id,
              Baseline: parseNumericValue(baseline),
              AssignedTarget: parseNumericValue(target),
              UnitId: targetUnitId,
              IncludeCurrentOffice: false,
              Name: derivedValue,
              Remark: '',
            });
            successCount++;
          } catch (err) {
            console.error('API Error during bulk upload:', err);
            failCount++;
          }
        }

        if (successCount > 0) {
          notify(`Successfully registered ${successCount} Derived KPI(s).${failCount > 0 ? ` Errors: ${failCount}` : ''}`, 'success');
          setRefreshToken((prev) => prev + 1);
          setActiveTab('view-drived');
        } else {
          let errorMessage = `Failed to register Derived KPIs. Check console for details. ${failCount} errors.`;
          if (noMatchCount === jsonData.length) {
            if (mainKpiOptions.length === 0) {
              errorMessage = 'No Main KPIs are available for derivation. Please ensure you have assigned KPIs first.';
            } else {
              const availableNames = mainKpiOptions.slice(0, 3).map((o) => `"${o.label}"`).join(', ');
              errorMessage = `No matches found. Your file has "${firstFailedName}", but the system has: ${availableNames}${mainKpiOptions.length > 3 ? '...' : ''}. Names must match.`;
            }
          }
          notify(errorMessage, 'error');
        }
      } catch (err) {
        console.error('Excel parsing error:', err);
        notify('Failed to parse Excel file.', 'error');
      } finally {
        setAssigning(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const headers = [['Main KPI', 'Unit', 'Baseline', 'Target', 'Derived KPI']];
    const examples = [
      ['Example KPI Name', 'Number', '0', '100', 'Task 1 | Task 2'],
      ['Another KPI', 'Percent', '10', '50', 'Sub-task A'],
    ];

    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet([...headers, ...examples]);

    // Add a sheet with valid KPI names and Units to help the user
    const validKpis = mainKpiOptions.map((opt) => [opt.label]);
    const validUnits = units.map((u) => [u.Code || u.Name]);

    const wsValidKpis = utils.aoa_to_sheet([['Valid Main KPI Names'], ...validKpis]);
    const wsValidUnits = utils.aoa_to_sheet([['Valid Unit Names (Codes)'], ...validUnits]);

    utils.book_append_sheet(wb, ws, 'Template');
    utils.book_append_sheet(wb, wsValidKpis, 'Valid KPI Names');
    utils.book_append_sheet(wb, wsValidUnits, 'Valid Units');

    writeFile(wb, 'Drived_KPI_Bulk_Upload_Template.xlsx');
  };

  const handleRequestDelete = (item) => {
    setDeletingDrivedKpi(item);
  };

  const confirmDeleteDrivedKpi = async () => {
    if (!deletingDrivedKpi?.id) return;

    deleteUserKpiMutation.mutate(deletingDrivedKpi.id, {
      onSuccess: () => {
        notify('Drived KPI deleted successfully.', 'success');
        setDeletingDrivedKpi(null);
      },
      onError: (err) => {
        notify(err?.response?.data?.message || 'Failed to delete Drived KPI.', 'error');
      }
    });
  };

  const handleDeleteAllDrivedKpis = async () => {
    if (drivedKpis.length === 0) return;
    
    try {
      setDeletingAll(true);
      await Promise.all(drivedKpis.map(kpi => deleteUserKpiMutation.mutateAsync(kpi.id)));
      notify(`Successfully deleted all ${drivedKpis.length} Drived KPI(s).`, 'success');
      setConfirmDeleteAll(false);
    } catch (error) {
      notify(error?.response?.data?.message || 'Failed to delete all Drived KPIs.', 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleEditSent = (row) => {
    setFormState((previous) => ({
      ...previous,
      mainKpi: row.mainKpiId,
      unit: units.find((u) => (u.Code || u.Name) === row.unit)?.Id || '',
      baseline: row.baseline || '',
      target: row.target || '',
      drivedKpis: row.drivedKpi.split(' | ').map((val) => ({ id: `${Date.now()}-${Math.random()}`, value: val })),
    }));
    setActiveTab('create-drived');
  };

  const totalPages = Math.ceil(drivedKpis.length / rowsPerPage);
  const paginatedDrivedKpis = drivedKpis.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const rowSpans = useMemo(() => {
    const spans = [];
    let i = 0;
    while (i < paginatedDrivedKpis.length) {
      let count = 1;
      for (let j = i + 1; j < paginatedDrivedKpis.length; j++) {
        if (paginatedDrivedKpis[j].parent === paginatedDrivedKpis[i].parent) {
          count++;
        } else {
          break;
        }
      }
      spans[i] = count;
      for (let k = 1; k < count; k++) {
        spans[i + k] = 0;
      }
      i += count;
    }
    return spans;
  }, [paginatedDrivedKpis]);

  const showManagerTabs = hasExtraMeasures || canCreate || canAssign;
  const visibleTableHeaders = tableHeaders;

  return (
    <div className="flex-1 min-h-full w-full space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Drived KPI Allocation</h1>
        <p className="text-sm text-muted-foreground">Monitor operational excellence and manage organizational assets.</p>
      </div>

      {catalogError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{catalogError}</p> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="view-drived">{hasExtraMeasures ? 'View Drived Kpi' : 'Assigned Drived kpi'}</TabsTrigger>
          {showManagerTabs && (
            <>
              {canAssign && <TabsTrigger value="assign-drived">Assign Drived Kpi</TabsTrigger>}
              {canCreate && <TabsTrigger value="create-drived">Create Drived Kpi</TabsTrigger>}
              <TabsTrigger value="view-sent-drived">View Sent Drived Kpi</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="view-drived" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>List Of Drived kpis</CardTitle>
              {hasExtraMeasures && drivedKpis.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setConfirmDeleteAll(true)} 
                  disabled={deletingAll || deleting}
                  className="h-9 gap-2"
                >
                  <Trash2 size={16} />
                  <span>Delete All</span>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden rounded-b-lg border-t border-border">
                {drivedKpis.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No Drived KPI has been created yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleTableHeaders.map((header) => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDrivedKpis.map((row, index) => (
                        <TableRow key={row.id}>
                          {rowSpans[index] > 0 && (
                            <TableCell 
                              className="font-medium text-primary/80 align-top border-r" 
                              rowSpan={rowSpans[index]}
                            >
                              {row.parent || 'null'}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {row.name || (Array.isArray(row.drived)
                                ? row.drived.map((item, index) => <span key={`${row.id}-${index}`}>{item}</span>)
                                : row.drived)}
                            </div>
                          </TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell>{row.baseline}</TableCell>
                          <TableCell>{row.target}</TableCell>
                          <TableCell>{row.remark}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100"
                                title="View Drived KPI details"
                                onClick={() => openDrivedKpiModal(row, 'view')}
                              >
                                <Eye className="h-4 w-4" />
                              </button>

                              {canModifyAssignedTarget ? (
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600 transition-colors hover:bg-green-100"
                                  title="Edit assigned target"
                                  onClick={() => openDrivedKpiModal(row, 'edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              ) : null}

                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                  title="Delete Drived KPI"
                                  onClick={() =>
                                    handleRequestDelete({
                                      id: row.id,
                                      title: Array.isArray(row.drived) ? row.drived.join(' | ') : row.drived,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * rowsPerPage, drivedKpis.length)}</span> of{' '}
                    <span className="font-medium">{drivedKpis.length}</span> results
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                            currentPage === page ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-drived" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create Drived Kpi</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-9 gap-2">
                  <Plus size={14} />
                  <span>Template</span>
                </Button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
                  <Upload size={16} />
                  <span>Bulk Upload</span>
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={assigning} />
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main KPI</p>
                  <CustomSelect
                    compact
                    options={mainKpiOptions.map((item) => item.label)}
                    value={selectedMainKpiLabel}
                    onChange={(label) => {
                      const match = mainKpiOptions.find((item) => item.label === label);
                      setFormState((previous) => ({ ...previous, mainKpi: match?.value || '' }));
                    }}
                    placeholder={loadingCatalog ? 'Loading assigned KPIs...' : 'List of Main Kpi'}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit</p>
                  <select
                    className={selectClassName}
                    value={formState.unit}
                    onChange={(event) => setFormState((previous) => ({ ...previous, unit: event.target.value }))}
                    disabled={loadingCatalog}
                  >
                    <option value="" disabled>
                      {loadingCatalog ? 'Loading units...' : 'Select Unit'}
                    </option>
                    {units.map((unit) => (
                      <option key={unit.Id} value={unit.Id}>
                        {unit.Code || unit.Name || 'Unnamed Unit'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base Line</p>
                  <Input
                    value={formState.baseline}
                    onChange={(event) => setFormState((previous) => ({ ...previous, baseline: event.target.value }))}
                    placeholder="Base Line"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                  <Input
                    value={formState.target}
                    onChange={(event) => setFormState((previous) => ({ ...previous, target: event.target.value }))}
                    placeholder="Target"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drived KPI</p>
                  <div className="space-y-2">
                    {formState.drivedKpis.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <Input
                          value={item.value}
                          onChange={(event) => handleDrivenKpiChange(item.id, event.target.value)}
                          placeholder={`Drived KPI ${index + 1}`}
                        />
                        {formState.drivedKpis.length > 1 && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                            aria-label="Remove Drived KPI"
                            onClick={() => handleRemoveDrivenKpi(item.id)}
                          >
                            <Minus size={16} />
                          </button>
                        )}
                        {index === formState.drivedKpis.length - 1 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
                            aria-label="Add another Drived KPI"
                            onClick={handleAddDrivenKpi}
                          >
                            <Plus size={16} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remark (Optional)</p>
                  <Input
                    value={formState.remark}
                    onChange={(event) => setFormState((previous) => ({ ...previous, remark: event.target.value }))}
                    placeholder="Enter any additional notes or remark..."
                  />
                </div>
              </div>

              <Button className="min-w-28" onClick={handleCreateDrivedKpi} disabled={assigning}>
                {assigning ? 'Saving...' : 'Create'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign-drived" className="space-y-4">
          <Card className="border-border bg-background/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle>Assign Drived KPI</CardTitle>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {selectedDrivedKpiRecords.length} KPI{selectedDrivedKpiRecords.length === 1 ? '' : 's'}
              </span>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Selection Criteria</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Role</p>
                    <select
                      className={selectClassName}
                      value={formState.staff}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          staff: event.target.value,
                          selectedUserIds: [],
                        }))
                      }
                    >
                      <option value="" disabled>
                        {childRoleOptions.length === 0 ? 'No registered child roles' : 'Select a child role'}
                      </option>
                      {childRoleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drived KPI</p>
                    <MultiSelect
                      options={drivedKpis.map((d) => ({ id: String(d.id), label: Array.isArray(d.drived) ? d.drived.join(' | ') : d.drived }))}
                      value={formState.drivedKpiAssignment.map((v) => String(v || ''))}
                      onChange={(values) => setFormState((previous) => ({ ...previous, drivedKpiAssignment: values }))}
                      placeholder={drivedKpis.length === 0 ? 'No created drived KPIs' : 'Select Drived KPI(s)'}
                      placement="top"
                    />
                  </div>

                  {!isDistributable && (
                    <div className="space-y-2 md:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target User(s)</p>
                      <MultiSelect
                        options={usersInSelectedRole.map((u) => ({ id: String(u.id), label: u.name }))}
                        value={formState.selectedUserIds.map((v) => String(v || ''))}
                        onChange={(values) => setFormState((previous) => ({ ...previous, selectedUserIds: values }))}
                        placeholder={usersInSelectedRole.length === 0 ? 'No users in this role' : 'Select User(s)'}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">KPI Details</p>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {selectedDrivedKpiRecords.length} KPI{selectedDrivedKpiRecords.length === 1 ? '' : 's'}
                  </span>
                </div>

                {selectedDrivedKpiRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select Drived KPI(s) to preview target distribution.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDrivedKpiRecords.map((item, index) => {
                      const currentTarget = assignmentTargetDrafts[String(item.id)] ?? item.assignedTarget ?? item.target ?? '';
                      const isCustomEditorOpen = Boolean(customTargetEditors[String(item.id)]);
                      const hasCustomTarget =
                        assignmentTargetDrafts[String(item.id)] !== undefined && String(assignmentTargetDrafts[String(item.id)]).trim() !== '';

                      return (
                        <div key={item.id} className="rounded-lg border border-border px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                                {index + 1}
                              </span>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KPI Name</p>
                                <p className="text-sm font-medium text-foreground">
                                  {Array.isArray(item.drived) ? item.drived.join(' | ') : item.drived || '—'}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedDrivedKpi(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KPI Target</p>
                            <button
                              type="button"
                              onClick={() => toggleCustomTargetEditor(item.id)}
                              className="inline-flex h-7 min-w-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary"
                            >
                              {formatValue(currentTarget)}
                            </button>

                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <Checkbox
                                checked={!!targetIndividualDrafts[String(item.id)]}
                                onCheckedChange={(checked) => {
                                  setTargetIndividualDrafts((prev) => ({ ...prev, [String(item.id)]: !!checked }));
                                }}
                              />
                              KPI Target individual
                            </label>

                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <Checkbox
                                checked={!!includeCurrentOfficeDrafts[String(item.id)]}
                                onCheckedChange={(checked) => {
                                  setIncludeCurrentOfficeDrafts((prev) => ({ ...prev, [String(item.id)]: !!checked }));
                                }}
                              />
                              Current Office
                            </label>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCustomTargetModalState({ open: true, kpiId: String(item.id) })}
                              className="h-7 px-2 text-[11px]"
                            >
                              Create custom target
                            </Button>
                          </div>



                          {isCustomEditorOpen ? (
                            <div className="mt-3 space-y-2">
                              <Input
                                type="number"
                                value={assignmentTargetDrafts[String(item.id)] ?? ''}
                                onChange={(event) =>
                                  setAssignmentTargetDrafts((previous) => ({
                                    ...previous,
                                    [String(item.id)]: event.target.value,
                                  }))
                                }
                                placeholder="Enter target to dispatch"
                              />
                            </div>
                          ) : null}

                          <div className="mt-3 rounded bg-muted/30 p-2 border border-border/50">
                            <p className="text-[11px] font-medium text-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="text-muted-foreground uppercase tracking-wider text-[10px]">Dispatching:</span> {formatValue(currentTarget)}</span>
                              <span><span className="text-muted-foreground uppercase tracking-wider text-[10px]">Receivers:</span> {getRecipientUserIdsForKpi(item.id).length}</span>
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span><span className="text-muted-foreground uppercase tracking-wider text-[10px]">Mode:</span> {targetIndividualDrafts[String(item.id)] ? 'Individual' : 'Shared (divided)'}</span>
                              <span className="text-primary font-bold">
                                <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Each Child Receives:</span> {' '}
                                {(() => {
                                  const num = getRecipientUserIdsForKpi(item.id).length;
                                  const t = Number(currentTarget) || 0;
                                  if (targetIndividualDrafts[String(item.id)] || num <= 1) return formatValue(t);
                                  return formatValue(Number((t / num).toFixed(2)));
                                })()}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ready to Assign</p>
                    <p className="text-xs text-muted-foreground">Complete selections above to enable assignment.</p>
                    <p className="mt-1 text-xs text-primary">Each selected child role will receive the Drived KPI target shown above.</p>
                  </div>

                  <Button onClick={handleAssignDrivedKpi} disabled={assigning || selectedDrivedKpiRecords.length === 0 || !hasAnyRecipients}>
                    {assigning ? 'Assigning...' : 'Assign Drived KPI'}
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view-sent-drived" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>View Sent Drived Kpi</CardTitle>
            </CardHeader>
            <CardContent>
              {sentDrivedKpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sent Drived KPI records available yet.</p>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Target Role</TableHead>
                        <TableHead>Target User</TableHead>
                        <TableHead>Drived KPI</TableHead>
                        <TableHead>Include Current Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentDrivedKpis.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.targetRole}</TableCell>
                          <TableCell>{item.targetUser}</TableCell>
                          <TableCell>{item.drivedKpi}</TableCell>
                          <TableCell>{item.includeCurrentRole ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600 transition-colors hover:bg-green-100"
                                title="Edit Sent KPI"
                                onClick={() => handleEditSent(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                                  title="Unallocate Sent KPI"
                                onClick={() =>
                                  handleRequestDelete({
                                    id: item.id,
                                    title: item.drivedKpi,
                                    type: 'unallocate',
                                  })
                                }
                              >
                                  <UserX className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(selectedDrivedKpi)}
        onOpenChange={(open) => {
          if (!open) {
            closeDrivedKpiModal();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{drivedKpiModalMode === 'edit' ? 'Edit Drived KPI Target' : 'Drived KPI Details'}</DialogTitle>
            <DialogDescription>Review the assigned KPI details and update the assigned target if needed.</DialogDescription>
          </DialogHeader>

          {selectedDrivedKpi ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drived KPI</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {Array.isArray(selectedDrivedKpi.drived) ? selectedDrivedKpi.drived.join(' | ') : selectedDrivedKpi.drived}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent KPI</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{selectedDrivedKpi.parent || 'null'}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{selectedDrivedKpi.unit || 'null'}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baseline</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{formatValue(selectedDrivedKpi.baseline)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original KPI Target</div>
                  <div className="mt-1 text-sm font-medium text-foreground">{formatValue(selectedDrivedKpi.originalTarget)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Target</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatValue(selectedDrivedKpi.assignedTarget ?? selectedDrivedKpi.target)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remark</div>
                <div className="mt-1 text-sm leading-6 text-foreground">{selectedDrivedKpi.remark || 'null'}</div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Target</p>
                <Input
                  type="number"
                  value={drivedTargetDraft}
                  onChange={(event) => setDrivedTargetDraft(event.target.value)}
                  placeholder="Enter assigned target"
                  disabled={!canModifyAssignedTarget || drivedKpiModalMode !== 'edit'}
                />
                {drivedKpiModalMode === 'view' ? (
                  <p className="text-xs text-muted-foreground">Open the edit action to change the target value.</p>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeDrivedKpiModal}>
                  Close
                </Button>
                {drivedKpiModalMode === 'edit' && canModifyAssignedTarget ? (
                  <Button onClick={handleSaveDrivedTarget} disabled={savingDrivedTarget}>
                    {savingDrivedTarget ? 'Saving...' : 'Save Target'}
                  </Button>
                ) : null}
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingDrivedKpi)} onOpenChange={(open) => !open && !deleting && setDeletingDrivedKpi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deletingDrivedKpi?.type === 'unallocate' ? 'Unallocate Sent KPI' : 'Delete Drived KPI'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {deletingDrivedKpi?.type === 'unallocate' ? 'unallocate' : 'delete'}{' '}
              <span className="font-semibold">{deletingDrivedKpi?.title || 'this Drived KPI'}</span>? 
              {deletingDrivedKpi?.type === 'unallocate' 
                ? ' This will remove the KPI from the recipient role.'
                : ' This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDrivedKpi(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDrivedKpi} disabled={deleting}>
              {deleting 
                ? (deletingDrivedKpi?.type === 'unallocate' ? 'Unallocating...' : 'Deleting...') 
                : (deletingDrivedKpi?.type === 'unallocate' ? 'Confirm Unallocate' : 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChildOfficesModal
        open={customTargetModalState.open}
        onOpenChange={(open) => setCustomTargetModalState((prev) => ({ ...prev, open }))}
        totalTarget={
          assignmentTargetDrafts[String(customTargetModalState.kpiId)] ??
          drivedKpis.find((d) => String(d.id) === String(customTargetModalState.kpiId))?.assignedTarget ??
          drivedKpis.find((d) => String(d.id) === String(customTargetModalState.kpiId))?.target ??
          0
        }
        offices={usersInSelectedRole.map((u) => ({ key: String(u.id), label: u.name }))}
        initialValues={customTargetDrafts[String(customTargetModalState.kpiId)] || {}}
        onSave={(values) => {
          setCustomTargetDrafts((prev) => ({
            ...prev,
            [String(customTargetModalState.kpiId)]: values,
          }));
        }}
        notify={notify}
      />

      <Dialog open={confirmDeleteAll} onOpenChange={(open) => !open && !deletingAll && setConfirmDeleteAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Drived KPIs</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-bold text-red-600">ALL {drivedKpis.length}</span> Drived KPIs? 
              This action will remove all local office measures and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAll(false)} disabled={deletingAll}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllDrivedKpis} disabled={deletingAll}>
              {deletingAll ? 'Deleting...' : 'Confirm Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrivedKpiAllocationPage;

