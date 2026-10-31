import { useEffect, useState } from 'react';
import { Eye, Trash2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Button from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../shared/components/ui/dialog';
import SearchInput from '../../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { useCan } from '../../../03-access-control/hooks/useCan';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import PersonAvatar from '../../components/PersonAvatar';
import { useDeletePerson, usePersons } from '../../hooks/useUsers';

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
const rolesOf = (person) => [...new Set(person.placements.flatMap((placement) => placement.roles.map((assignment) => assignment.role.name)))].join(', ') || 'None';

function UserList({ onAdd }) {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const can = useCan();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const deletePerson = useDeletePerson();
  const { data, isLoading, error } = usePersons({ search: appliedSearch, page, limit: PAGE_SIZE });
  const people = data?.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const confirmDelete = () =>
    deletePerson.mutate(deleting.id, {
      onSuccess: (result) => {
        setDeleting(null);
        notify(result.message, result.deactivated ? 'warning' : 'success');
      },
      onError: (failure) => notify(apiErrorMessage(failure, 'Could not delete this person.'), 'error'),
    });

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, staff number..." className="max-w-sm" />
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
                        <button onClick={() => setDeleting(person)} className="rounded p-1 text-destructive hover:bg-destructive/10" title="Delete" aria-label={`Delete ${person.fullName}`}>
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

        <TablePagination currentPage={page} totalItems={data?.pagination?.total ?? 0} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletePerson.isPending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Delete <span className="font-semibold">{deleting?.fullName}</span>? Someone referenced by institutional records is deactivated instead, so their history stays.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletePerson.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePerson.isPending}>
              {deletePerson.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UserList;
