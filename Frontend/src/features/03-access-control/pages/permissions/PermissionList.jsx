import { useState } from 'react';

import SearchInput from '../../../../shared/components/ui/SearchInput';
import { matchesPermission } from '../../lib/permissionCatalog';

function PermissionList({ rows }) {
  const [search, setSearch] = useState('');
  const shown = rows.filter((row) => matchesPermission(row, search));

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{shown.length} Permissions</h3>
          <p className="text-xs text-muted-foreground">Every permission the system checks. These come with the system and cannot be added here.</p>
        </div>
        <div className="w-full sm:w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search permissions..." />
        </div>
      </div>

      {shown.length === 0 && <p className="px-4 py-8 text-sm text-muted-foreground">No permissions match your search.</p>}
      <ul className="divide-y divide-border">
        {shown.map((permission) => (
          <li key={permission.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{permission.description}</p>
              <p className="text-xs text-muted-foreground">{permission.moduleName}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{permission.code}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PermissionList;
