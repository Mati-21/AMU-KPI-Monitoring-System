import { Fragment } from 'react';
import * as Switch from '@radix-ui/react-switch';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../shared/components/ui/Table';
import { groupByModule, matchesPermission } from '../../lib/permissionCatalog';

function PermissionTable({ rows, granted, readOnly, search, onToggle }) {
  const groups = groupByModule(rows.filter((row) => matchesPermission(row, search)));

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permission</TableHead>
            <TableHead>Code</TableHead>
            <TableHead className="w-28 text-center">Allowed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>No permissions match your search.</TableCell>
            </TableRow>
          )}
          {groups.map(({ moduleName, permissions }) => (
            <Fragment key={moduleName}>
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  {moduleName}
                </TableCell>
              </TableRow>
              {permissions.map((permission) => (
                <TableRow key={permission.code}>
                  <TableCell>
                    <p className="text-sm text-foreground">{permission.description}</p>
                    <p className="text-[11px] text-muted-foreground">{permission.resourceLabel}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{permission.code}</TableCell>
                  <TableCell className="text-center">
                    <Switch.Root
                      checked={granted.has(permission.code)}
                      disabled={readOnly}
                      onCheckedChange={() => onToggle(permission.code)}
                      aria-label={permission.code}
                      className="relative h-5 w-10 rounded-full bg-gray-300 transition data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-600 dark:data-[state=checked]:bg-primary"
                    >
                      <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default PermissionTable;
