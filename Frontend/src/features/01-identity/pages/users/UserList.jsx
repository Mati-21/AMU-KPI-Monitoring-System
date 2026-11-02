import { useEffect, useState } from 'react';
import { Archive, Eye, UserPlus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Button from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import CustomSelect from '../../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { ConfirmDialog } from '../../../02-offices/components/FormParts';
import { useCan } from '../../../03-access-control/hooks/useCan';
import { useRolesQuery } from '../../../03-access-control/hooks/useRoles';
import { roleNames } from '../../../03-access-control/lib/roleAssignments';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import PersonAvatar from '../../components/PersonAvatar';
import { useArchivePerson, usePersons } from '../../hooks/useUsers';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const COLUMN_COUNT = 6;

const AccountBadge = ({ account }) => {
  if (!account) return <Badge variant="outline">No login</Badge>;
  return account.isActive ? (
    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
      Deactivated
    </Badge>
  );
};

const officesOf = (person) => person.placements.map((placement) => placement.office.name).join(', ') || 'Not placed';
const rolesOf = (person) => roleNames(person.placements.flatMap((placement) => placement.roles));

const ALL_ROLES = 'all';
const NO_ROLE = 'none';

const roleParams = (roleFilter) => {
  if (!roleFilter) return {};
  return roleFilter === NO_ROLE ? { hasRole: false } : { roleId: roleFilter };
};

const RoleFilter = ({ value, onChange }) => {
  const { data: roles = [] } = useRolesQuery();
  const options = [{ value: ALL_ROLES, label: 'All roles' }, { value: NO_ROLE, label: 'No role' }, ...roles.map((role) => ({ value: role.id, label: role.name }))];

  return (
    <div className="w-56">
      <CustomSelect compact options={options} value={value ?? ALL_ROLES} onChange={onChange} />
    </div>
  );
};

function UserList({ onAdd }) {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const can = useCan();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [archiving, setArchiving] = useState(null);
  const archivePerson = useArchivePerson();
  const [searchParams, setSearchParams] = useSearchParams();
  // Listing roles takes one of these permissions, so without them there is nothing to filter by
  const canFilterByRole = can('role:read', 'role:assign');
  const roleId = canFilterByRole ? searchParams.get('roleId') : null;
  const { data, isLoading, error } = usePersons({ search: appliedSearch, page, limit: PAGE_SIZE, isActive: true, ...roleParams(roleId) });
  const people = data?.data ?? [];

  const changeRole = (next) => {
    setSearchParams(next === ALL_ROLES ? {} : { roleId: next }, { replace: true });
    setPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const closeArchive = () => {
    archivePerson.reset();
    setArchiving(null);
  };

  const confirmArchive = () =>
    archivePerson.mutate(archiving.id, {
      onSuccess: () => {
        notify(`${archiving.fullName} was archived.`, 'success');
        closeArchive();
      },
    });

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, staff number..." className="max-w-sm" />
            {canFilterByRole && <RoleFilter value={roleId} onChange={changeRole} />}
          </div>
          {onAdd && (
            <Button onClick={onAdd} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load people.')}</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Offices</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT}>Loading people...</TableCell>
                </TableRow>
              )}
              {!isLoading && people.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT}>No people found.</TableCell>
                </TableRow>
              )}
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={person.fullName} className="h-9 w-9 shrink-0 text-xs" />
                      <div>
                        <p className="font-medium text-foreground">{person.fullName}</p>
                        <p className="text-xs text-muted-foreground">{person.email || 'No email yet'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{person.account?.username ?? '-'}</TableCell>
                  <TableCell>{officesOf(person)}</TableCell>
                  <TableCell>{rolesOf(person)}</TableCell>
                  <TableCell>
                    <AccountBadge account={person.account} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/users/${person.id}`)} className="rounded p-1 text-primary hover:bg-primary/10" title="Open" aria-label={`Open ${person.fullName}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                      {can('user:delete') && (
                        <button onClick={() => setArchiving(person)} className="rounded p-1 text-destructive hover:bg-destructive/10" title="Archive" aria-label={`Archive ${person.fullName}`}>
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <TablePagination currentPage={page} totalItems={data?.pagination?.total ?? 0} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <ConfirmDialog open={Boolean(archiving)} onClose={closeArchive} title="Archive User" description={`Archive ${archiving?.fullName}? This is permanent: they can no longer sign in, and they leave this list, their offices and their roles. Their email and staff number become free to register again. Their history stays.`} onConfirm={confirmArchive} error={archivePerson.error} pending={archivePerson.isPending} confirmLabel="Archive" />
    </>
  );
}

export default UserList;
