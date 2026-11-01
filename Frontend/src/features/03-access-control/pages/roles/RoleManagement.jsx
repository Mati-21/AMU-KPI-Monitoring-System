import { useState } from 'react';
import { Edit, Eye, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge } from '../../../../shared/components/ui/Badge';
import Button from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import SearchInput from '../../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { ConfirmDialog, Field, FormDialog } from '../../../02-offices/components/FormParts';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import RoleDetailDialog from '../../components/RoleDetailDialog';
import { useCan } from '../../hooks/useCan';
import { useDeleteRole, usePermissionCatalog, useRolesQuery, useSaveRole } from '../../hooks/useRoles';
import { flattenCatalog } from '../../lib/permissionCatalog';
import AddRole from './AddRole';

const PAGE_SIZE = 10;
const COLUMN_COUNT = 5;

const EditRoleDialog = ({ role, onClose }) => {
  const { notify } = useNotification();
  const save = useSaveRole();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');

  const submit = (event) => {
    event.preventDefault();
    save.mutate(
      { id: role.id, values: { name, description } },
      {
        onSuccess: () => {
          notify('Role saved.', 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title="Edit Role" description="Update the role details below." onSubmit={submit} error={save.error} pending={save.isPending}>
      <Field label="Role Name" required hint={role.isSystem ? 'This system role cannot be renamed.' : undefined}>
        <Input required disabled={role.isSystem} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
    </FormDialog>
  );
};

const RoleManagement = () => {
  const can = useCan();
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: roles = [], isLoading, error } = useRolesQuery();
  const { data: catalog } = usePermissionCatalog();
  const remove = useDeleteRole();
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canCreate = can('role:create');
  // The dashboard's shortcut links here with the form already open
  const [adding, setAdding] = useState(() => canCreate && searchParams.get('tab') === 'addRole');

  const closeAdd = () => {
    setAdding(false);
    setSearchParams({}, { replace: true });
  };
  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const openPermissions = (role) => navigate(`/permission?role=${role.id}`);

  const text = search.trim().toLowerCase();
  const shown = roles.filter((role) => !text || role.name.toLowerCase().includes(text) || role.description?.toLowerCase().includes(text));
  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);

  const closeDelete = () => {
    remove.reset();
    setDeleting(null);
  };

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify('Role deleted.', 'success');
        closeDelete();
      },
    });

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
          <p className="text-sm text-muted-foreground">A role is a named set of permissions you can give to people placed in offices.</p>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Registered Roles ({shown.length})</h2>
              <p className="mt-1 text-xs text-muted-foreground">All roles currently registered in the system.</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <div className="w-full sm:w-80">
                <SearchInput value={search} onChange={changeSearch} placeholder="Search roles..." />
              </div>
              {canCreate && (
                <Button type="button" className="gap-2" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" />
                  Add Role
                </Button>
              )}
            </div>
          </div>

          {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load roles.')}</p>}

          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28">Permissions</TableHead>
                  <TableHead className="w-20">People</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>Loading roles...</TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>No roles found.</TableCell>
                  </TableRow>
                )}
                {shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        {role.name}
                        {role.isSystem && <Badge variant="outline">System</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="truncate" title={role.description ?? undefined}>
                      {role.description || 'No description'}
                    </TableCell>
                    <TableCell>{role.isSystem ? 'All' : role.permissionCount}</TableCell>
                    <TableCell>{role.activeAssignments}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setViewing(role)} aria-label={`View ${role.name}`} title="View role" className="rounded p-1 text-primary hover:bg-primary/10">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => openPermissions(role)} aria-label={`Permissions of ${role.name}`} title="Permissions" className="rounded p-1 text-primary hover:bg-primary/10">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        {can('role:update') && (
                          <button type="button" onClick={() => setEditing(role)} aria-label={`Edit ${role.name}`} title="Edit role" className="rounded p-1 text-primary hover:bg-primary/10">
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {can('role:delete') && !role.isSystem && (
                          <button type="button" onClick={() => setDeleting(role)} aria-label={`Delete ${role.name}`} title="Delete role" className="rounded p-1 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TablePagination currentPage={currentPage} totalItems={shown.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-4" />
        </div>

        {adding && <AddRole onClose={closeAdd} onSaved={openPermissions} />}
        {viewing && <RoleDetailDialog role={viewing} rows={flattenCatalog(catalog)} onEdit={openPermissions} onClose={() => setViewing(null)} />}
        {editing && <EditRoleDialog role={editing} onClose={() => setEditing(null)} />}
        <ConfirmDialog open={Boolean(deleting)} onClose={closeDelete} title="Delete Role" description={`Delete "${deleting?.name}"? A role that people still hold cannot be deleted.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />
      </main>
    </div>
  );
};

export default RoleManagement;
