import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShieldCheck, ClipboardList, BarChart3, Users, FileText, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/UI/Card';
import permissionUtils from '../../lib/permissionUtils';

const moduleCards = [
  { module: 'KPI Management', title: 'KPI Management', description: 'Manage and review KPI items', icon: Target },
  { module: 'KPI Allocation', title: 'KPI Allocation', description: 'Assign KPIs to child units and roles', icon: ClipboardList },
  { module: 'Sub Unit', title: 'Sub Unit Oversight', description: 'View and manage subordinate units', icon: Users },
  { module: 'KPI Reporting', title: 'Reporting', description: 'Access office and role performance summaries', icon: FileText },
  { module: 'KPI Evaluation', title: 'Evaluation', description: 'Track evaluations and progress', icon: BarChart3 },
  { module: 'Registered KPIs', title: 'Registered KPIs', description: 'View role-available registered KPI catalog', icon: ShieldCheck },
];

const RoleDashboard = () => {
  const authUser = useSelector((state) => state.auth?.user);
  const userPermissions = useMemo(() => authUser?.permissions || [], [authUser?.permissions]);

  const visibleCards = useMemo(() => {
    if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
      return moduleCards;
    }

    return moduleCards.filter((card) => {
      const permissions = card.permissions || [
        permissionUtils.permissionKey('view', card.module),
        permissionUtils.permissionKey('create', card.module),
        permissionUtils.permissionKey('edit', card.module),
        permissionUtils.permissionKey('delete', card.module),
      ];

      return permissionUtils.hasPermission(userPermissions, permissions);
    });
  }, [userPermissions]);

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Permission Dashboard</h1>
        <p className="text-sm text-muted-foreground">This dashboard adapts to the permissions assigned to your account.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.module} className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!visibleCards.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No module permissions are currently assigned to your account.</CardContent>
        </Card>
      ) : null}
    </main>
  );
};

export default RoleDashboard;
