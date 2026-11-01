import { useState } from 'react';
import { Eye } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import AuditEntryDialog from '../components/AuditEntryDialog';
import { useAuditFilters, useAuditLogs } from '../hooks/useSystem';
import { actionLabel, entityLabel, formatDateTime } from '../lib/auditFormat';

const PAGE_SIZE = 15;
const COLUMN_COUNT = 6;
const ALL = 'all';
const NO_FILTERS = { action: ALL, entityType: ALL, actorPersonId: ALL, from: '', to: '' };

const FilterSelect = ({ allLabel, options, value, onChange }) => (
  <div className="w-52">
    <CustomSelect compact options={[{ value: ALL, label: allLabel }, ...options]} value={value} onChange={onChange} />
  </div>
);

const sentFilters = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== ALL));

const SystemLogs = () => {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const { data, isLoading, error } = useAuditLogs({ ...sentFilters(filters), page, limit: PAGE_SIZE });
  const { data: choices } = useAuditFilters();
  const entries = data?.data ?? [];
  const isFiltered = Object.keys(sentFilters(filters)).length > 0;

  const setFilter = (field) => (value) => {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPage(1);
  };

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Logs</h1>
          <p className="text-sm text-muted-foreground">Who did what and when, newest first.</p>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
            <FilterSelect allLabel="All actions" options={(choices?.actions ?? []).map((action) => ({ value: action, label: actionLabel(action) }))} value={filters.action} onChange={setFilter('action')} />
            <FilterSelect allLabel="All items" options={(choices?.entityTypes ?? []).map((type) => ({ value: type, label: entityLabel(type) }))} value={filters.entityType} onChange={setFilter('entityType')} />
            <FilterSelect allLabel="All people" options={(choices?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.fullName }))} value={filters.actorPersonId} onChange={setFilter('actorPersonId')} />
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">From</span>
              <Input type="date" max={filters.to || undefined} value={filters.from} onChange={(event) => setFilter('from')(event.target.value)} className="h-9 w-40" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">To</span>
              <Input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilter('to')(event.target.value)} className="h-9 w-40" />
            </label>
            {isFiltered && (
              <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load the logs.')}</p>}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>Loading logs...</TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT}>No log entries found.</TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>{entry.actor?.fullName ?? 'System'}</TableCell>
                    <TableCell className="font-medium text-foreground">{actionLabel(entry.action)}</TableCell>
                    <TableCell>{entityLabel(entry.entityType)}</TableCell>
                    <TableCell>{entry.ipAddress ?? '-'}</TableCell>
                    <TableCell>
                      <button type="button" onClick={() => setOpenId(entry.id)} aria-label={`View ${actionLabel(entry.action)}`} title="View details" className="rounded p-1 text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <TablePagination currentPage={page} totalItems={data?.pagination?.total ?? 0} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-4" />
        </div>

        {openId && <AuditEntryDialog entryId={openId} onClose={() => setOpenId(null)} />}
      </main>
    </div>
  );
};

export default SystemLogs;
