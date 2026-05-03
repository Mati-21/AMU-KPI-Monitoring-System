import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, KeyRound, LayoutGrid, MoreVertical, Plus, ShieldCheck } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';

import Button from '../../../Components/UI/Button';
import { Badge } from '../../../Components/UI/Badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../Components/UI/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../../Components/UI/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../Components/UI/Table';
import PermissionTable from './PermissionTable';
import StatCard from './StatCard';
import Header from './Header';
import Toolbar from './Toolbar';
import { api } from '../../../api/axios';
import { setUser } from '../../../Features/authSlice';
import { normalizeAuthUser } from '../../../lib/authUser';
import permissionUtils from '../../../lib/permissionUtils';
import { navigationSections } from '../../../Config/navigation';
import { useNotification } from '../../../Context/NotificationContext';

const MATRIX_ACTIONS = ['view', 'create', 'assign', 'edit', 'delete', 'approve'];
const LEGACY_PERMISSION_RESOURCES = ['Performance', 'Assign KPI', 'KPI Evaluation', 'Audit Log', 'System Settings'];
const EXTRA_PERMISSION_KEYS = [
  permissionUtils.permissionKey('create', 'Child Office Accounts'),
  permissionUtils.permissionKey('create', 'Sub Unit'),
  permissionUtils.permissionKey('view', 'User Management'),
  permissionUtils.permissionKey('create', 'User Management'),
  permissionUtils.permissionKey('edit', 'User Management'),
  permissionUtils.permissionKey('delete', 'User Management'),
  permissionUtils.permissionKey('view', 'Role Management'),
  permissionUtils.permissionKey('create', 'Role Management'),
  permissionUtils.permissionKey('edit', 'Role Management'),
  permissionUtils.permissionKey('delete', 'Role Management'),
  permissionUtils.permissionKey('view', 'Other Affiliated Office Reports'),
  permissionUtils.permissionKey('view', 'Other Role Reports'),
  permissionUtils.permissionKey('view', 'Sub Unit'),
  permissionUtils.permissionKey('edit', 'Sub Unit'),
  permissionUtils.permissionKey('delete', 'Sub Unit'),
];

const SYSTEM_ADMIN_ROLE_NAMES = new Set(['system administrator', 'admin']);

const MATRIX_ACTION_SET = new Set(MATRIX_ACTIONS);

const PERMISSION_SCOPE_ALIASES = new Map([
  [normalizePermissionScope('Other Role Reports'), normalizePermissionScope('Other Affiliated Office Reports')],
]);

const normalizePermissionScopeKey = (value) => PERMISSION_SCOPE_ALIASES.get(normalizePermissionScope(value)) || normalizePermissionScope(value);

function normalizePermissionScope(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const titleCase = (value) =>
  String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const permissionKeysToDisplay = (key) => {
  if (key === 'admin_dashboard') {
    return 'Admin Dashboard';
  }

  const normalizedKey = String(key || '')
    .trim()
    .toLowerCase();
  const match = normalizedKey.match(/^([a-z]+)_(.+)$/);

  if (!match) {
    return titleCase(permissionUtils.normalizePermissionDisplay(normalizedKey));
  }

  return titleCase(permissionUtils.normalizePermissionDisplay(normalizePermissionScopeKey(match[2])));
};

const parsePermissionKey = (key) => {
  const normalized = String(key || '')
    .trim()
    .toLowerCase();
  const match = normalized.match(/^([a-z]+)_(.+)$/);
  if (!match) {
    return null;
  }

  const action = match[1];
  const resourceKey = normalizePermissionScopeKey(match[2]);
  if (!resourceKey || !MATRIX_ACTION_SET.has(action)) {
    return null;
  }

  return {
    action,
    resourceKey,
  };
};

const buildPermissionRows = (roleName, rows) => {
  void roleName;
  return rows.map(({ resourceKey, label }) => ({
    module: label,
    resourceKey,
    view: false,
    create: false,
    assign: false,
    edit: false,
    delete: false,
    approve: false,
  }));
};

const isSystemAdminRoleName = (roleName) =>
  SYSTEM_ADMIN_ROLE_NAMES.has(
    String(roleName || '')
      .trim()
      .toLowerCase()
  );

const mergePermissions = (roleName, savedPermissions, rows) => {
  const defaults = buildPermissionRows(roleName, rows);
  if (!Array.isArray(savedPermissions) || !savedPermissions.length) return defaults;

  const byScope = new Map(
    savedPermissions.map((permission) => [
      normalizePermissionScopeKey(permission.module || permission.resource || permission.name || permission.label),
      permission,
    ])
  );

  return defaults.map((permission) => {
    const saved = byScope.get(permission.resourceKey);
    if (!saved) return permission;

    return {
      module: permission.module,
      resourceKey: permission.resourceKey,
      view: Boolean(saved.view),
      create: Boolean(saved.create),
      assign: Boolean(saved.assign),
      edit: Boolean(saved.edit),
      delete: Boolean(saved.delete),
      approve: Boolean(saved.approve),
    };
  });
};

const getRoleCategoryName = (role) =>
  role?.RoleCategory?.name ||
  role?.RoleCategory?.Name ||
  role?.RoleCategory?.RoleCategory ||
  role?.RoleCategory?.roleCategory ||
  role?.roleCategory ||
  'Uncategorized';

const getRolePermissions = (role) => (Array.isArray(role?.Permissions) ? role.Permissions : []);

const summarizeRolePermissions = (role) => {
  const rawPermissions = getRolePermissions(role);
  const permissionKeys = permissionUtils.flattenPermissions(rawPermissions);
  const counts = rawPermissions.reduce(
    (accumulator, permission) => {
      ['view', 'create', 'assign', 'edit', 'delete', 'approve'].forEach((action) => {
        if (permission?.[action]) {
          accumulator[action] += 1;
          accumulator.total += 1;
        }
      });
      return accumulator;
    },
    { total: 0, view: 0, create: 0, assign: 0, edit: 0, delete: 0, approve: 0 }
  );
  const activeScopes = rawPermissions.filter((permission) =>
    ['view', 'create', 'assign', 'edit', 'delete', 'approve'].some((action) => Boolean(permission?.[action]))
  ).length;

  return {
    permissionKeys,
    counts,
    activeScopes,
    rawPermissions,
  };
};

const PermissionManagement = () => {
  const dispatch = useDispatch();
  const { notify } = useNotification();
  const authUser = useSelector((state) => state.auth?.user);
  const [activeTab, setActiveTab] = useState('matrix');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleLoadError, setRoleLoadError] = useState('');
  const [selectedRoleForDetails, setSelectedRoleForDetails] = useState(null);

  const permissionRows = useMemo(() => {
    const scopeMap = new Map();

    const addScope = (permissionKey) => {
      const normalizedKey = String(permissionKey || '')
        .trim()
        .toLowerCase();
      if (!normalizedKey || normalizedKey === 'admin_dashboard') {
        return;
      }

      const match = normalizedKey.match(/^([a-z]+)_(.+)$/);
      if (!match) {
        return;
      }

      const resourceKey = normalizePermissionScopeKey(match[2]);
      if (!resourceKey || scopeMap.has(resourceKey)) {
        return;
      }

      scopeMap.set(resourceKey, {
        resourceKey,
        label: permissionKeysToDisplay(normalizedKey),
      });
    };

    const keys = new Set(['admin_dashboard']);

    navigationSections.forEach((section) => {
      section.items.forEach((item) => {
        const itemPermissions = Array.isArray(item.permissions) ? item.permissions : [];
        itemPermissions.forEach((permission) => {
          if (permission) {
            keys.add(String(permission));
          }
        });
      });
    });

    LEGACY_PERMISSION_RESOURCES.forEach((resource) => {
      MATRIX_ACTIONS.forEach((action) => {
        const key = permissionUtils.permissionKey(action, resource);
        if (key) keys.add(key);
      });
    });

    EXTRA_PERMISSION_KEYS.forEach((key) => {
      if (key) keys.add(key);
    });

    [...keys].forEach(addScope);

    return [...scopeMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const filteredProjectPermissions = useMemo(() => {
    const query = String(permissionSearch || '')
      .trim()
      .toLowerCase();
    if (!query) return permissionRows;

    return permissionRows.filter((permission) => permission.resourceKey.includes(query) || permission.label.toLowerCase().includes(query));
  }, [permissionRows, permissionSearch]);

  const isPermissionEnabledByKey = (permissionRows, permissionKey) => {
    const parsed = parsePermissionKey(permissionKey);
    if (!parsed) {
      return false;
    }

    const permissionRow = permissionRows.find((entry) => entry.resourceKey === parsed.resourceKey);
    return Boolean(permissionRow?.[parsed.action]);
  };

  const setPermissionEnabledByKey = (permissionRows, permissionKey, nextValue) => {
    const parsed = parsePermissionKey(permissionKey);
    if (!parsed) {
      return permissionRows;
    }

    return permissionRows.map((permission) => {
      if (permission.resourceKey !== parsed.resourceKey) {
        return permission;
      }

      return {
        ...permission,
        [parsed.action]: Boolean(nextValue),
      };
    });
  };

  const sidebarVisibilityItems = useMemo(() => {
    const rows = [];

    navigationSections.forEach((section) => {
      section.items.forEach((item) => {
        const itemPermissions = Array.isArray(item.permissions) ? item.permissions : [];
        const normalizedKeys = itemPermissions
          .map((key) =>
            String(key || '')
              .trim()
              .toLowerCase()
          )
          .filter((key) => key && key !== 'admin_dashboard' && Boolean(parsePermissionKey(key)));

        if (!normalizedKeys.length) {
          return;
        }

        const primaryKey = normalizedKeys.find((key) => parsePermissionKey(key)?.action === 'view') || normalizedKeys[0];

        rows.push({
          id: `${section.label}:${item.label}:${item.path}`,
          section: section.label,
          label: item.label,
          path: item.path,
          permissionKeys: normalizedKeys,
          primaryPermissionKey: primaryKey,
        });
      });
    });

    return rows;
  }, []);

  const [permissions, setPermissions] = useState(buildPermissionRows('', permissionRows));

  const filteredSidebarVisibilityRows = useMemo(() => {
    const query = String(matrixSearch || '')
      .trim()
      .toLowerCase();

    const rows = sidebarVisibilityItems.map((item) => ({
      ...item,
      enabled: item.permissionKeys.some((key) => isPermissionEnabledByKey(permissions, key)),
    }));

    if (!query) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.label.toLowerCase().includes(query) ||
        row.section.toLowerCase().includes(query) ||
        row.primaryPermissionKey.includes(query) ||
        row.permissionKeys.some((key) => key.includes(query))
    );
  }, [matrixSearch, permissions, sidebarVisibilityItems]);

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

  const filteredRoles = useMemo(() => {
    const query = String(roleSearch || '')
      .trim()
      .toLowerCase();
    if (!query) return roles;

    return roles.filter((role) => {
      const summary = summarizeRolePermissions(role);
      const searchableText = [role?.RoleName, getRoleCategoryName(role), role?.Description, summary.permissionKeys.join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [roleSearch, roles]);

  const roleCardIcon = (role) => {
    const roleName = String(role?.RoleName || '').toLowerCase();
    if (roleName.includes('admin') || roleName.includes('system')) return ShieldCheck;
    if (roleName.includes('dean') || roleName.includes('vice')) return LayoutGrid;
    return KeyRound;
  };

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
        setPermissions(mergePermissions(firstRole, firstRoleRecord?.Permissions, permissionRows));
      } catch (loadErr) {
        if (!mounted) return;
        setRoleLoadError(loadErr?.response?.data?.message || 'Failed to load registered roles.');
        setRoles([]);
        setSelectedRole('');
        setPermissions(buildPermissionRows('', permissionRows));
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
    setPermissions(mergePermissions(role, roleRecord?.Permissions, permissionRows));
  };

  const handleToggleSidebarButton = (row) => {
    if (!row) {
      return;
    }

    setPermissions((prev) => {
      const isCurrentlyEnabled = row.permissionKeys.some((key) => isPermissionEnabledByKey(prev, key));

      if (isCurrentlyEnabled) {
        return row.permissionKeys.reduce((nextRows, key) => setPermissionEnabledByKey(nextRows, key, false), prev);
      }

      return setPermissionEnabledByKey(prev, row.primaryPermissionKey, true);
    });
  };

  const handleSave = async () => {
    if (!selectedRoleRecord?.Id) {
      setRoleLoadError('No registered role selected.');
      return;
    }

    setSaving(true);
    setRoleLoadError('');

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
      setPermissions(mergePermissions(selectedRole, refreshedSelected?.Permissions, permissionRows));
      notify('Permissions saved successfully.', 'success', 3000, { position: 'center' });

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
    { key: 'sidebarMatrix', label: 'Sidebar Visibility Matrix' },
    { key: 'permissionList', label: 'List of Permission' },
    { key: 'roles', label: 'Roles' },
  ];

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <Header />

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

          {/* Toolbar */}
          {(activeTab === 'matrix' || activeTab === 'sidebarMatrix') && (
            <Toolbar
              selectedRole={selectedRole}
              setSearch={setMatrixSearch}
              handleRoleChange={handleRoleChange}
              search={matrixSearch}
              roles={roleOptions}
              loadingRoles={loadingRoles}
            />
          )}

          {activeTab === 'permissionList' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Permissions Used In Project</h3>
                    <p className="text-xs text-muted-foreground">
                      Unique permission keys currently used by navigation, route guards, and matrix settings.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(event) => setPermissionSearch(event.target.value)}
                    placeholder="Search permission key..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {filteredProjectPermissions.length} Permission Scopes
                </div>

                {filteredProjectPermissions.length ? (
                  <ul className="max-h-105 overflow-y-auto divide-y divide-border">
                    {filteredProjectPermissions.map((permission) => (
                      <li key={permission.resourceKey} className="px-4 py-2.5 text-sm text-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{permission.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">{permission.resourceKey}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-8 text-sm text-muted-foreground">No permissions match your search.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Role Cards</h3>
                    <p className="text-xs text-muted-foreground">Each role card shows a snapshot of its permissions and extra insight.</p>
                  </div>

                  <input
                    type="text"
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.target.value)}
                    placeholder="Search roles..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredRoles.map((role) => {
                  const summary = summarizeRolePermissions(role);
                  const permissionCount = summary.permissionKeys.length;
                  const roleCategory = getRoleCategoryName(role);
                  const roleName = role?.RoleName || 'Unnamed Role';
                  const parentRoleName = roles.find((entry) => entry?.Id === role?.ParentRoleId)?.RoleName || 'None';
                  const Icon = roleCardIcon(role);

                  return (
                    <Card
                      key={role?.Id || roleName}
                      onClick={() => setSelectedRoleForDetails(role)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
                    >
                      <CardHeader className="space-y-4 p-0 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base text-foreground">{roleName}</CardTitle>
                              <p className="mt-1 text-xs text-muted-foreground">{roleCategory}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedRoleForDetails(role);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="View details"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {permissionCount} permissions
                          </Badge>
                          <Badge variant="outline">{summary.activeScopes} scopes</Badge>
                          <Badge variant="outline">{summary.counts.total} grants</Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5 p-0">
                        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div className="rounded-xl border border-border bg-muted/40 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parent Role</p>
                            <p className="mt-1 text-sm font-semibold leading-tight text-foreground">{parentRoleName}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-muted/40 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Measures</p>
                            <p
                              className={`mt-1 text-sm font-semibold leading-tight ${role?.HasExtraMeasures ? 'text-primary' : 'text-muted-foreground'}`}
                            >
                              {role?.HasExtraMeasures ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Permission Preview</p>
                          <div className="flex flex-wrap gap-1.5">
                            {summary.permissionKeys.slice(0, 4).map((permission) => (
                              <Badge
                                key={permission}
                                variant="outline"
                                className="border-border bg-background px-2 py-1 font-medium text-[11px] text-foreground"
                              >
                                {permissionKeysToDisplay(permission)}
                              </Badge>
                            ))}
                            {summary.permissionKeys.length > 4 ? (
                              <Badge variant="outline" className="border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                                +{summary.permissionKeys.length - 4} more
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {!filteredRoles.length ? (
                <p className="rounded-md border border-border bg-card px-4 py-8 text-sm text-muted-foreground">No roles match your search.</p>
              ) : null}
            </div>
          )}

          {/* Matrix */}
          {(activeTab === 'matrix' || activeTab === 'sidebarMatrix') && (
            <div className="space-y-4">
              {activeTab === 'sidebarMatrix' ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Sidebar button visibility controls (one toggle per sidebar button).</p>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/10">
                          <TableHead className="font-semibold text-foreground">Sidebar Button</TableHead>
                          <TableHead className="font-semibold text-foreground">Permission Key</TableHead>
                          <TableHead className="font-semibold text-foreground text-center w-32">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSidebarVisibilityRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-foreground">{row.label}</p>
                                <p className="text-[11px] text-muted-foreground">{row.section}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-mono text-xs text-foreground">{row.primaryPermissionKey}</p>
                                <p className="text-[11px] text-muted-foreground">{permissionKeysToDisplay(row.primaryPermissionKey)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch.Root
                                checked={row.enabled}
                                onCheckedChange={() => handleToggleSidebarButton(row)}
                                className="relative h-5 w-10 rounded-full bg-gray-300 transition data-[state=checked]:bg-primary"
                              >
                                <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-5" />
                              </Switch.Root>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!filteredSidebarVisibilityRows.length ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-sm text-muted-foreground">
                              No sidebar buttons match your search.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <PermissionTable permissions={permissions} setPermissions={setPermissions} search={matrixSearch} />
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}

          <Dialog open={Boolean(selectedRoleForDetails)} onOpenChange={(open) => !open && setSelectedRoleForDetails(null)}>
            <DialogContent className="max-w-4xl">
              {selectedRoleForDetails
                ? (() => {
                    const summary = summarizeRolePermissions(selectedRoleForDetails);
                    const roleName = selectedRoleForDetails?.RoleName || 'Unnamed Role';
                    const roleCategory = getRoleCategoryName(selectedRoleForDetails);
                    const parentRoleName = roles.find((entry) => entry?.Id === selectedRoleForDetails?.ParentRoleId)?.RoleName || 'None';
                    const Icon = roleCardIcon(selectedRoleForDetails);

                    return (
                      <>
                        <DialogHeader className="text-left">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <DialogTitle>{roleName}</DialogTitle>
                              <DialogDescription>
                                Full role insight, including permission counts, role metadata, and key-based access details.
                              </DialogDescription>
                            </div>
                          </div>
                        </DialogHeader>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">General Info</p>
                            <div className="space-y-2 text-sm">
                              <p>
                                <span className="font-medium text-foreground">Role Name:</span> {roleName}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Category:</span> {roleCategory}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Parent Role:</span> {parentRoleName}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Description:</span>{' '}
                                {selectedRoleForDetails?.Description || 'No description provided.'}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Extra Measures:</span>{' '}
                                {selectedRoleForDetails?.HasExtraMeasures ? 'Enabled' : 'Disabled'}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permission Insight</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Permission Keys</p>
                                <p className="mt-1 text-foreground">{summary.permissionKeys.length}</p>
                              </div>
                              <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Scopes</p>
                                <p className="mt-1 text-foreground">{summary.activeScopes}</p>
                              </div>
                              <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Granted Actions</p>
                                <p className="mt-1 text-foreground">{summary.counts.total}</p>
                              </div>
                              <div className="rounded-md border border-border bg-background/50 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">View Grants</p>
                                <p className="mt-1 text-foreground">{summary.counts.view}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permission Keys</p>
                          <div className="flex flex-wrap gap-2">
                            {summary.permissionKeys.map((permission) => (
                              <Badge key={permission} variant="outline" className="border-border bg-background px-2 py-1 font-mono text-[10px]">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()
                : null}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default PermissionManagement;
