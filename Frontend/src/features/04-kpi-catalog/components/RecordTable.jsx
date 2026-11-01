import { Plus } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';

/**
 * A titled card with an optional Add button and a table of records.
 */
const RecordTable = ({ title, description, addLabel, onAdd, columns, rows, isLoading, error, emptyText = 'Nothing here yet.' }) => (
  <div className="rounded-lg border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {onAdd && (
        <Button type="button" className="gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      )}
    </div>
    {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load this list.')}</p>}
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.label} className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={columns.length}>Loading...</TableCell>
            </TableRow>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length}>{emptyText}</TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column.label} className={column.className}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export const IconAction = ({ icon, label, onClick, danger }) => {
  const Icon = icon;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`rounded p-1 ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
};

export default RecordTable;
