import { useState } from 'react';

import { Badge } from '../../../shared/components/ui/Badge';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useOfficeList, useOfficeTypes } from '../hooks/useOffices';

const PAGE_SIZE = 10;
const COLUMN_COUNT = 6;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const matches = (office, { search, typeId, status }) => {
  const text = search.trim().toLowerCase();
  if (text && !office.name.toLowerCase().includes(text) && !office.code?.toLowerCase().includes(text)) return false;
  if (typeId !== 'all' && office.officeType.id !== typeId) return false;
  if (status !== 'all' && office.isActive !== (status === 'active')) return false;
  return true;
};

const OfficeListPanel = ({ onOpen }) => {
  const { data: offices = [], isLoading, error } = useOfficeList();
  const { data: types = [] } = useOfficeTypes();
  const [filters, setFilters] = useState({ search: '', typeId: 'all', status: 'all' });
  const [page, setPage] = useState(1);

  const setFilter = (field) => (value) => {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  };

  const shown = offices.filter((office) => matches(office, filters));
  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const pageRows = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const typeOptions = [{ value: 'all', label: 'All types' }, ...types.map((type) => ({ value: type.id, label: type.name }))];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="min-w-56 flex-1">
          <SearchInput value={filters.search} onChange={setFilter('search')} placeholder="Search by name or code..." />
        </div>
        <div className="w-48">
          <CustomSelect compact options={typeOptions} value={filters.typeId} onChange={setFilter('typeId')} />
        </div>
        <div className="w-48">
          <CustomSelect compact options={STATUS_OPTIONS} value={filters.status} onChange={setFilter('status')} />
        </div>
      </div>

      {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load offices.')}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reports To</TableHead>
              <TableHead>Sub-offices</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && !error && shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>No offices found.</TableCell>
              </TableRow>
            )}
            {pageRows.map((office) => (
              <TableRow key={office.id}>
                <TableCell>
                  <button type="button" onClick={() => onOpen(office.id)} className="text-left font-medium text-primary hover:underline">
                    {office.name}
                  </button>
                </TableCell>
                <TableCell>{office.code || '-'}</TableCell>
                <TableCell>{office.officeType.name}</TableCell>
                <TableCell>{office.parent?.name ?? '-'}</TableCell>
                <TableCell>{office.childCount}</TableCell>
                <TableCell>
                  <Badge variant="outline">{office.isActive ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination currentPage={currentPage} totalItems={shown.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-4" />
    </div>
  );
};

export default OfficeListPanel;
