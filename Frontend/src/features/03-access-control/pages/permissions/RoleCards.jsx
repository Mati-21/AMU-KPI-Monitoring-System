import { useState } from 'react';

import { Badge } from '../../../../shared/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../shared/components/ui/Card';
import SearchInput from '../../../../shared/components/ui/SearchInput';
import RoleDetailDialog, { RoleIcon } from '../../components/RoleDetailDialog';

const PREVIEW_COUNT = 4;

function RoleCards({ roles, rows, onEdit }) {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const text = search.trim().toLowerCase();
  const shown = roles.filter((role) => !text || role.name.toLowerCase().includes(text) || role.description?.toLowerCase().includes(text) || role.permissionCodes.some((code) => code.includes(text)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Role Cards</h3>
          <p className="text-xs text-muted-foreground">A snapshot of what each role may do. Click one for the full list.</p>
        </div>
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search roles..." />
        </div>
      </div>

      {shown.length === 0 && <p className="rounded-md border border-border bg-card px-4 py-8 text-sm text-muted-foreground">No roles match your search.</p>}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((role) => (
          <Card key={role.id} onClick={() => setDetail(role)} className="cursor-pointer rounded-2xl border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
            <CardHeader className="space-y-4 p-0 pb-4">
              <div className="flex items-start gap-3">
                <RoleIcon role={role} />
                <div className="min-w-0">
                  <CardTitle className="text-base text-foreground">{role.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{role.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{role.isSystem ? 'All permissions' : `${role.permissionCount} ${role.permissionCount === 1 ? 'permission' : 'permissions'}`}</Badge>
                <Badge variant="outline">{role.activeAssignments === 1 ? '1 person' : `${role.activeAssignments} people`}</Badge>
              </div>
            </CardHeader>
            {!role.isSystem && (
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-1.5">
                  {role.permissionCodes.slice(0, PREVIEW_COUNT).map((code) => (
                    <Badge key={code} variant="outline" className="font-mono text-[10px]">
                      {code}
                    </Badge>
                  ))}
                  {role.permissionCodes.length > PREVIEW_COUNT && (
                    <Badge variant="outline" className="text-[10px] text-primary">
                      +{role.permissionCodes.length - PREVIEW_COUNT} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {detail && <RoleDetailDialog role={detail} rows={rows} onEdit={onEdit} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default RoleCards;
