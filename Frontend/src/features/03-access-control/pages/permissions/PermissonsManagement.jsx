import { useState } from 'react';
import { Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import Button from '../../../../shared/components/ui/Button';
import TabButton from '../../../../shared/components/ui/TabButton';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { ConfirmDialog } from '../../../02-offices/components/FormParts';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useCan } from '../../hooks/useCan';
import { usePermissionCatalog, useRolesQuery, useSaveRolePermissions } from '../../hooks/useRoles';
import { flattenCatalog } from '../../lib/permissionCatalog';
import Header from './Header';
import PermissionList from './PermissionList';
import PermissionTable from './PermissionTable';
import RoleCards from './RoleCards';
import StatCard from './StatCard';
import Toolbar from './Toolbar';

const sameCodes = (a, b) => a.size === b.size && [...a].every((code) => b.has(code));

const PermissionManagement = () => {
  const can = useCan();
  const { notify } = useNotification();
  const [searchParams] = useSearchParams();
  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useRolesQuery();
  const { data: catalog, error: catalogError } = usePermissionCatalog();
  const saveCodes = useSaveRolePermissions();
  const [tab, setTab] = useState('matrix');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(searchParams.get('role'));
  const [edited, setEdited] = useState(null);
  const [leavingFor, setLeavingFor] = useState(null);

  const rows = flattenCatalog(catalog);
  const role = roles.find((candidate) => candidate.id === selectedId) ?? roles.find((candidate) => !candidate.isSystem) ?? roles[0];
  const saved = new Set(role?.permissionCodes);
  const granted = role?.isSystem ? new Set(rows.map((row) => row.code)) : (edited ?? saved);
  const isDirty = Boolean(edited) && !sameCodes(edited, saved);
  const readOnly = !can('role:update') || Boolean(role?.isSystem);
  const problem = rolesError || catalogError || saveCodes.error;

  const showRole = (id) => {
    saveCodes.reset();
    setEdited(null);
    setSelectedId(id);
  };

  const chooseRole = (id) => {
    if (id === role?.id) return;
    if (isDirty) setLeavingFor(id);
    else showRole(id);
  };

  const toggle = (code) => {
    const next = new Set(granted);
    if (!next.delete(code)) next.add(code);
    setEdited(next);
  };

  const save = () =>
    saveCodes.mutate(
      { id: role.id, permissionCodes: [...granted] },
      {
        onSuccess: () => {
          setEdited(null);
          notify('Permissions saved.', 'success');
        },
      }
    );

  const openInMatrix = (target) => {
    chooseRole(target.id);
    setTab('matrix');
  };

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <Header />

        <StatCard totalRoles={roles.length} systemModules={catalog?.modules.length ?? 0} activePermissions={granted.size} restrictedPermissions={rows.length - granted.size} />

        <div className="flex flex-wrap gap-2">
          <TabButton label="Permission Matrix" value="matrix" activeValue={tab} onChange={setTab} />
          <TabButton label="List of Permissions" value="list" activeValue={tab} onChange={setTab} />
          <TabButton label="Roles" value="roles" activeValue={tab} onChange={setTab} />
        </div>

        {problem && <p className="text-sm text-red-500">{apiErrorMessage(problem, 'Could not load permissions.')}</p>}

        {tab === 'matrix' && (
          <div className="space-y-4">
            <Toolbar options={roles.map(({ id, name }) => ({ value: id, label: name }))} selectedId={role?.id ?? ''} selectedName={role?.name} onSelect={chooseRole} search={search} setSearch={setSearch} loading={rolesLoading} />
            {role?.isSystem && <p className="text-sm text-muted-foreground">{role.name} always has every permission, so it cannot be changed here.</p>}
            {role && <PermissionTable rows={rows} granted={granted} readOnly={readOnly} search={search} onToggle={toggle} />}
            {!readOnly && (
              <div className="flex items-center justify-end gap-3">
                {isDirty && <span className="text-sm text-muted-foreground">You have unsaved changes.</span>}
                <Button type="button" className="gap-2" onClick={save} disabled={!isDirty || saveCodes.isPending}>
                  <Save className="h-4 w-4" />
                  {saveCodes.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === 'list' && <PermissionList rows={rows} />}
        {tab === 'roles' && <RoleCards roles={roles} rows={rows} onEdit={openInMatrix} />}

        <ConfirmDialog
          open={Boolean(leavingFor)}
          onClose={() => setLeavingFor(null)}
          title="Discard Changes"
          description={`Your changes to "${role?.name}" have not been saved.`}
          onConfirm={() => {
            showRole(leavingFor);
            setLeavingFor(null);
          }}
          confirmLabel="Discard"
        />
      </main>
    </div>
  );
};

export default PermissionManagement;
