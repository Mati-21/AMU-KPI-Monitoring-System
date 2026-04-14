import { useEffect, useMemo, useState } from 'react';
import { Edit, Eye, Trash2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TablePagination } from '../../../Components/UI/Table';
import SearchInput from '../../../Components/UI/SearchInput';
import { api } from '../../../api/axios';

function UserList({ setActiveTab }) {
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);
  const [currentPage, setCurrentPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [usersRaw, setUsersRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      setLoading(true);
      setError('');

      try {
        const usersRes = await api.get('/users', { params: { t: Date.now() } });
        if (!mounted) return;
        setUsersRaw(usersRes.data?.data || []);
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load users from database.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const users = useMemo(
    () =>
      usersRaw.map((u) => {
        const activeRole = u?.UserRoles?.[0]?.Role;
        const firstName = u.FirstName || '';
        const fatherName = u.FatherName || '';
        const grandFatherName = u.GrandFatherName || '';
        const fullName = [firstName, fatherName, grandFatherName].filter(Boolean).join(' ').trim();

        return {
          id: u.Id,
          fullName: fullName || u.UserName || 'Unknown User',
          initials: `${firstName?.[0] || ''}${fatherName?.[0] || ''}`.toUpperCase() || 'U',
          email: u.Email || '-',
          userName: u.UserName || '-',
          phone: u.Phone || '-',
          role: activeRole?.RoleName || 'Unassigned',
          roleCategory: activeRole?.RoleCategory?.CategoryName || 'No Category',
          officeLevel: activeRole?.RoleName || '-',
          joinedDate: u.CreatedAt ? new Date(u.CreatedAt).toISOString().slice(0, 10) : '-',
        };
      }),
    [usersRaw]
  );

  const effectiveSearch = internalSearch.toLowerCase();

  const handleDeleteUser = async (user) => {
    const authId = String(authUser?.id || authUser?.Id || '');
    if (authId && String(user.id) === authId) {
      window.alert('You cannot delete your own account from this table.');
      return;
    }

    const confirmed = window.confirm(`Delete user "${user.fullName}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/users/${user.id}`);
      setRefreshKey((prev) => prev + 1);
    } catch (deleteErr) {
      window.alert(deleteErr?.response?.data?.message || 'Failed to delete user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = `${u.fullName} ${u.email} ${u.userName}`.toLowerCase().includes(effectiveSearch);
    return matchesSearch;
  });

  const totalItems = filteredUsers.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Registered Users</h2>
        {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">Total registered users: {users.length}</p>

          <div className="flex flex-wrap items-stretch gap-3 md:justify-end">
            <SearchInput value={internalSearch} onChange={setInternalSearch} placeholder="Search users..." className="min-w-64" />

            <button
              onClick={() => setActiveTab('add')}
              className="flex min-w-36 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Role Category</TableHead>
                <TableHead>Office Level</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading users...</TableCell>
                </TableRow>
              ) : paginatedUsers.length ? (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {user.initials}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.fullName}</p>
                          <p className="text-xs text-muted-foreground">{user.phone || 'No phone yet'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.roleCategory}</TableCell>
                    <TableCell>{user.officeLevel}</TableCell>
                    <TableCell>{user.joinedDate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/profile/${user.id}`, { state: { startEditing: true } })}
                          className="rounded p-1 text-foreground hover:bg-muted"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => navigate(`/admin/profile/${user.id}`)}
                          className="rounded p-1 text-primary hover:bg-primary/10"
                          title="View profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7}>No users found in the database.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
      </div>
    </>
  );
}

export default UserList;
