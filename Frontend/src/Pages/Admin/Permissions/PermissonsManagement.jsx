import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Button from '../../../Components/UI/Button';
import PermissionTable from './PermissionTable';
import StatCard from './StatCard';
import Header from './Header';
import Toolbar from './Toolbar';
import { api } from '../../../api/axios';
import { setUser } from '../../../Features/authSlice';
import { normalizeAuthUser } from '../../../lib/authUser';

const modules = [
  'Performance',
  'Assigned KPI',
  'KPI Management',
  'KPI Allocation',
  'Assign KPI',
  'Sub Unit',
  'Registered KPIs',
  'KPI Evaluation',
  'KPI Reporting',
  'User Management',
  'Role Management',
  'Configuration',
  'Audit Log',
  'Alerts & Notifications',
  'Personal Profile',
  'System Settings',
];

const generatePermissions = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  const isAdmin = normalizedRole.includes('admin');
  const isManager = normalizedRole.includes('manager');
  const isDepartmentHead = normalizedRole.includes('department head') || normalizedRole.includes('head');

  return modules.map((module) => ({
    module,
    view: true,
    create: isAdmin || isManager,
    edit: isAdmin || isManager,
    delete: isAdmin,
    approve: isAdmin || isDepartmentHead,
  }));
};

const mergePermissions = (roleName, savedPermissions) => {
  const defaults = generatePermissions(roleName);
  if (!Array.isArray(savedPermissions) || !savedPermissions.length) return defaults;

  const byModule = new Map(savedPermissions.map((permission) => [permission.module, permission]));

  return defaults.map((permission) => {
    const saved = byModule.get(permission.module);
    if (!saved) return permission;

    return {
      module: permission.module,
      view: Boolean(saved.view),
      create: Boolean(saved.create),
      edit: Boolean(saved.edit),
      delete: Boolean(saved.delete),
      approve: Boolean(saved.approve),
    };
  });
};

const PermissionManagement = () => {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth?.user);
  const [activeTab, setActiveTab] = useState('matrix');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [search, setSearch] = useState('');
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleLoadError, setRoleLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const roleOptions = useMemo(() => {
    const seen = new Set();
    const uniqueNames = [];

    roles.forEach((role) => {
      const rawName = String(role?.RoleName || '').trim();
      if (!rawName) return;

      const normalized = rawName.toLowerCase();
      if (seen.has(normalized)) return;

      seen.add(normalized);
      uniqueNames.push(rawName);
    });

    return uniqueNames;
  }, [roles]);

  const [permissions, setPermissions] = useState(generatePermissions(''));

  const selectedRoleRecord = useMemo(
    () =>
      roles.find(
        (role) =>
          String(role?.RoleName || '')
            .trim()
            .toLowerCase() ===
          String(selectedRole || '')
            .trim()
            .toLowerCase()
      ) || null,
    [roles, selectedRole]
  );

  useEffect(() => {
    let mounted = true;

    const loadRoles = async () => {
      setLoadingRoles(true);
      setRoleLoadError('');

      try {
        const response = await api.get('/roles', { params: { t: Date.now() } });
        if (!mounted) return;

        const fetchedRoles = response.data?.data || [];
        setRoles(fetchedRoles);

        const firstRole = fetchedRoles[0]?.RoleName || '';
        setSelectedRole(firstRole);
        const firstRoleRecord = fetchedRoles.find(
          (role) =>
            String(role?.RoleName || '')
              .trim()
              .toLowerCase() ===
            String(firstRole || '')
              .trim()
              .toLowerCase()
        );
        setPermissions(mergePermissions(firstRole, firstRoleRecord?.Permissions));
      } catch (loadErr) {
        if (!mounted) return;
        setRoleLoadError(loadErr?.response?.data?.message || 'Failed to load registered roles.');
        setRoles([]);
        setSelectedRole('');
        setPermissions(generatePermissions(''));
      } finally {
        if (mounted) setLoadingRoles(false);
      }
    };

    loadRoles();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    const roleRecord = roles.find(
      (registeredRole) =>
        String(registeredRole?.RoleName || '')
          .trim()
          .toLowerCase() ===
        String(role || '')
          .trim()
          .toLowerCase()
    );
    setPermissions(mergePermissions(role, roleRecord?.Permissions));
  };

  const handleSave = async () => {
    if (!selectedRoleRecord?.Id) {
      setRoleLoadError('No registered role selected.');
      return;
    }

    setSaving(true);
    setRoleLoadError('');
    setSaveMessage('');

    try {
      await api.put(`/roles/${selectedRoleRecord.Id}`, {
        RoleCategoryId: selectedRoleRecord.RoleCategoryId || selectedRoleRecord?.RoleCategory?.Id || null,
        RoleName: selectedRoleRecord.RoleName,
        ParentRoleId: selectedRoleRecord.ParentRoleId || null,
        Description: selectedRoleRecord.Description || null,
        HasExtraMeasures: Boolean(selectedRoleRecord.HasExtraMeasures),
        Permissions: permissions,
      });

      const rolesRes = await api.get('/roles', { params: { t: Date.now() } });
      const refreshedRoles = rolesRes.data?.data || [];
      setRoles(refreshedRoles);

      const refreshedSelected = refreshedRoles.find((role) => role.Id === selectedRoleRecord.Id);
      setPermissions(mergePermissions(selectedRole, refreshedSelected?.Permissions));
      setSaveMessage('Permissions saved successfully.');

      // Keep current logged-in user permissions in sync if their role was edited.
      const currentRoleName = String(authUser?.roleName || authUser?.role || '')
        .trim()
        .toLowerCase();
      const editedRoleName = String(selectedRoleRecord.RoleName || '')
        .trim()
        .toLowerCase();
      if (currentRoleName && currentRoleName === editedRoleName) {
        const meRes = await api.get('/auth/me');
        const normalized = normalizeAuthUser(meRes.data?.user, meRes.data?.role);
        dispatch(setUser(normalized));
      }
    } catch (saveErr) {
      setRoleLoadError(saveErr?.response?.data?.message || 'Failed to save permissions.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'matrix', label: 'Permission Matrix' },
    { key: 'byRole', label: 'By Role' },
    { key: 'byModule', label: 'By Module' },
  ];

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <Header onSave={handleSave} saving={saving} />

          {/* Stats */}
          <StatCard />

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <Button key={tab.key} variant={activeTab === tab.key ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </Button>
            ))}
          </div>

          {roleLoadError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{roleLoadError}</p> : null}
          {saveMessage ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saveMessage}</p>
          ) : null}

          {/* Toolbar */}
          <Toolbar
            selectedRole={selectedRole}
            setSearch={setSearch}
            handleRoleChange={handleRoleChange}
            search={search}
            roles={roleOptions}
            loadingRoles={loadingRoles}
          />

          {/* Matrix */}
          {activeTab === 'matrix' && <PermissionTable permissions={permissions} setPermissions={setPermissions} search={search} />}
        </main>
      </div>
    </div>
  );
};

export default PermissionManagement;
