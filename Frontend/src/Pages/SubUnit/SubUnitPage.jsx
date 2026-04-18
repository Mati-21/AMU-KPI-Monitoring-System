import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import { Badge } from '../../Components/UI/Badge';
import { api } from '../../api/axios';

const isActiveAssignment = (assignment) => {
  if (!assignment) return false;
  if (assignment.IsArchived) return false;
  if (!assignment.ToDate) return true;
  return new Date(assignment.ToDate).getTime() >= Date.now();
};

const fullNameFromUser = (user) => {
  if (!user) return 'Unknown User';
  const first = user.FirstName || '';
  const father = user.FatherName || '';
  const grand = user.GrandFatherName || '';
  return `${first} ${father} ${grand}`.trim() || user.UserName || user.Email || 'Unknown User';
};

function SubUnitPage() {
  const authUser = useSelector((state) => state.auth?.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const [rolesRes, userRolesRes] = await Promise.all([
          api.get('/roles', { params: { t: Date.now() } }),
          api.get('/user-roles', { params: { t: Date.now() } }),
        ]);

        if (!mounted) return;

        setRoles(rolesRes.data?.data || []);
        setUserRoles((userRolesRes.data?.data || []).filter(isActiveAssignment));
      } catch (loadErr) {
        if (!mounted) return;
        setError(loadErr?.response?.data?.message || 'Failed to load sub-unit data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const childUnits = useMemo(() => {
    const parentRoleId = String(authUser?.roleId || '');
    if (!parentRoleId) return [];

    const childRoles = roles.filter((role) => String(role.ParentRoleId || '') === parentRoleId);

    return childRoles
      .map((role) => {
        const members = userRoles
          .filter((assignment) => String(assignment?.RoleId || assignment?.Role?.Id || '') === String(role.Id))
          .map((assignment) => ({
            id: assignment?.User?.Id || assignment?.UserId,
            name: fullNameFromUser(assignment?.User),
            username: assignment?.User?.UserName || '—',
            email: assignment?.User?.Email || '—',
          }));

        return {
          roleId: role.Id,
          roleName: role.RoleName || 'Unnamed Unit',
          members,
        };
      })
      .sort((left, right) => left.roleName.localeCompare(right.roleName));
  }, [roles, userRoles, authUser?.roleId]);

  const hasAnyMembers = useMemo(() => childUnits.some((unit) => unit.members.length > 0), [childUnits]);

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sub Unit</h1>
        <p className="text-sm text-muted-foreground">List of child offices and registered users under your role</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading sub-unit data...</p> : null}

      {!loading && childUnits.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No child office is registered under your role.
        </div>
      ) : null}

      {!loading && childUnits.length > 0 && !hasAnyMembers ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Child offices exist, but no registered users were found under them.
        </div>
      ) : null}

      {!loading && childUnits.length > 0
        ? childUnits.map((unit) => (
            <Card key={unit.roleId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-primary" />
                    {unit.roleName}
                  </CardTitle>
                  <Badge variant="secondary">{unit.members.length} members</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {unit.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No registered users under this office.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-160 text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Full Name</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Username</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unit.members.map((member) => (
                          <tr key={`${unit.roleId}-${member.id}`} className="border-t border-border">
                            <td className="px-3 py-2 text-foreground">{member.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{member.username}</td>
                            <td className="px-3 py-2 text-muted-foreground">{member.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        : null}
    </div>
  );
}

export default SubUnitPage;
