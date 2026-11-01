import { useEffect, useState } from 'react';
import { Edit3, Eye, FileSpreadsheet, Power, Replace } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import SearchInput from '../../../shared/components/ui/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TablePagination, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { optionLabel } from '../../10-system/lib/settingValues';
import KpiDetailDialog from '../components/KpiDetailDialog';
import { IconAction } from '../components/RecordTable';
import { fetchAllKpis, useKpis, useObjectives, useSaveRecord, useThemeTree } from '../hooks/useCatalog';
import { MEASUREMENT_TYPES, themeNames, themeOptions, toOptions } from '../lib/kpiRules';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const COLUMN_COUNT = 8;
const ALL = 'all';
const NO_FILTERS = { themeId: ALL, strategicObjectiveId: ALL, measurementType: ALL, isActive: ALL };
const STATUS_OPTIONS = [
  { value: ALL, label: 'All statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Retired' },
];

const Filter = ({ allLabel, options, value, onChange }) => (
  <div className="w-48">
    <CustomSelect compact options={[{ value: ALL, label: allLabel }, ...options]} value={value} onChange={onChange} />
  </div>
);

const sentFilters = (filters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ALL));

const toSheetRow = (kpi, themes) => ({
  Code: kpi.code,
  Name: kpi.name,
  Theme: themeNames(themes, kpi.themeId).theme ?? kpi.theme?.name ?? '',
  'Sub-Theme': themeNames(themes, kpi.themeId).subTheme ?? '',
  'Strategic Objective': kpi.strategicObjective?.name ?? '',
  'Measurement Type': optionLabel(kpi.measurementType),
  Direction: optionLabel(kpi.direction),
  'Reporting Frequency': kpi.defaultFrequency?.name ?? '',
  Status: kpi.isActive ? 'Active' : 'Retired',
});

function KpiList({ onEdit, onReplace }) {
  const can = useCan();
  const { notify } = useNotification();
  const { data: themes = [] } = useThemeTree();
  const { data: objectives = [] } = useObjectives();
  const save = useSaveRecord('kpis');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [retiring, setRetiring] = useState(null);
  const [exporting, setExporting] = useState(false);
  const params = { ...sentFilters(filters), ...(appliedSearch && { search: appliedSearch }) };
  const { data, isLoading, error } = useKpis({ ...params, page, limit: PAGE_SIZE });
  const kpis = data?.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const setFilter = (field) => (value) => {
    setFilters({ ...filters, [field]: value });
    setPage(1);
  };

  const closeRetire = () => {
    save.reset();
    setRetiring(null);
  };

  const setActive = (kpi, isActive) =>
    save.mutate(
      { id: kpi.id, values: { isActive } },
      {
        onSuccess: () => {
          notify(isActive ? `${kpi.code} is active again.` : `${kpi.code} was retired.`, 'success');
          closeRetire();
        },
        onError: (failure) => {
          if (isActive) notify(apiErrorMessage(failure, 'Could not change this KPI.'), 'error');
        },
      }
    );

  const exportExcel = async () => {
    setExporting(true);
    try {
      const sheet = XLSX.utils.json_to_sheet((await fetchAllKpis(params)).map((kpi) => toSheetRow(kpi, themes)));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'KPIs');
      XLSX.writeFile(book, 'kpis.xlsx');
    } catch (failure) {
      notify(apiErrorMessage(failure, 'Could not export the KPIs.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="min-w-56 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by code or name..." />
        </div>
        <Filter allLabel="All themes" options={themeOptions(themes)} value={filters.themeId} onChange={setFilter('themeId')} />
        <Filter allLabel="All objectives" options={objectives.map((objective) => ({ value: objective.id, label: objective.name }))} value={filters.strategicObjectiveId} onChange={setFilter('strategicObjectiveId')} />
        <Filter allLabel="All types" options={toOptions(MEASUREMENT_TYPES)} value={filters.measurementType} onChange={setFilter('measurementType')} />
        <div className="w-40">
          <CustomSelect compact options={STATUS_OPTIONS} value={filters.isActive} onChange={setFilter('isActive')} />
        </div>
        <Button type="button" variant="outline" className="gap-2" disabled={exporting || kpis.length === 0} onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </div>

      {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load the KPIs.')}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Theme</TableHead>
              <TableHead>Sub-Theme</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>Loading KPIs...</TableCell>
              </TableRow>
            )}
            {!isLoading && !error && kpis.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>No KPIs found.</TableCell>
              </TableRow>
            )}
            {kpis.map((kpi) => (
              <TableRow key={kpi.id}>
                <TableCell className="font-medium text-foreground">{kpi.code}</TableCell>
                <TableCell>{kpi.name}</TableCell>
                <TableCell>{themeNames(themes, kpi.themeId).theme ?? kpi.theme?.name ?? '-'}</TableCell>
                <TableCell>{themeNames(themes, kpi.themeId).subTheme ?? '-'}</TableCell>
                <TableCell>{optionLabel(kpi.measurementType)}</TableCell>
                <TableCell>{kpi.defaultFrequency?.name ?? '-'}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="outline">{kpi.isActive ? 'Active' : 'Retired'}</Badge>
                    {kpi.isLocked && <Badge variant="outline">In use</Badge>}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <IconAction icon={Eye} label={`View ${kpi.code}`} onClick={() => setViewing(kpi)} />
                    {can('kpi:update') && <IconAction icon={Edit3} label={`Edit ${kpi.code}`} onClick={() => onEdit(kpi)} />}
                    {can('kpi:create') && kpi.replacedBy?.length === 0 && <IconAction icon={Replace} label={`Replace ${kpi.code}`} onClick={() => onReplace(kpi)} />}
                    {can('kpi:update') && kpi.replacedBy?.length === 0 && <IconAction icon={Power} label={`${kpi.isActive ? 'Retire' : 'Reactivate'} ${kpi.code}`} danger={kpi.isActive} onClick={() => (kpi.isActive ? setRetiring(kpi) : setActive(kpi, true))} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination currentPage={page} totalItems={data?.pagination?.total ?? 0} itemsPerPage={PAGE_SIZE} onPageChange={setPage} className="px-4" />

      {viewing && <KpiDetailDialog kpi={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog open={Boolean(retiring)} onClose={closeRetire} title="Retire KPI" description={`Retire ${retiring?.code}? It stays in the history and can be reactivated, but it can no longer be chosen for new work.`} onConfirm={() => setActive(retiring, false)} error={save.error} pending={save.isPending} confirmLabel="Retire" />
    </div>
  );
}

export default KpiList;
