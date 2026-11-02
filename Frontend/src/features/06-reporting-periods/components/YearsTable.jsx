import { useState } from 'react';
import { CheckCircle2, Edit3, Lock, LockOpen } from 'lucide-react';
import { useSelector } from 'react-redux';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { formatDate } from '../../02-offices/lib/officeTree';
import { nextFiscalYear } from '../lib/fiscalYear';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import RecordTable, { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { optionLabel } from '../../10-system/lib/settingValues';
import { useSaveYear, useYearStatus } from '../hooks/usePlanning';

const YEAR_FIELDS = [
  { key: 'name', label: 'Name', required: true, hint: 'For example 2019 E.C.' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date', required: true },
];

const REASON_FIELDS = [{ key: 'reason', label: 'Reason', type: 'textarea', required: true, hint: 'Kept in the system logs.' }];

const YearsTable = ({ years, selectedId, onSelect, isLoading, error }) => {
  const can = useCan();
  const { notify } = useNotification();
  const isSuperAdmin = useSelector((state) => state.auth.user?.isSuperAdmin);
  const save = useSaveYear();
  const activate = useYearStatus('activate');
  const close = useYearStatus('close');
  const reopen = useYearStatus('reopen');
  const [dialog, setDialog] = useState(null);
  const canManage = can('kpi:manage');

  const activateYear = (year) =>
    activate.mutate(
      { id: year.id },
      {
        onSuccess: () => notify(`${year.name} is now the active year.`, 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not activate this year.'), 'error'),
      }
    );

  const columns = [
    {
      label: 'Year',
      render: (row) => (
        <Button type="button" size="sm" variant={row.id === selectedId ? 'default' : 'outline'} onClick={() => onSelect(row.id)}>
          {row.name}
        </Button>
      ),
    },
    { label: 'Start', render: (row) => formatDate(row.startDate) },
    { label: 'End', render: (row) => formatDate(row.endDate) },
    { label: 'Status', render: (row) => <Badge variant="outline">{optionLabel(row.status)}</Badge> },
    { label: 'Periods', render: (row) => row.periodCount },
    { label: 'Contracts', render: (row) => row.contractCount },
    {
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          {canManage && row.status === 'PLANNING' && <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ type: 'edit', year: row })} />}
          {canManage && row.status === 'PLANNING' && <IconAction icon={CheckCircle2} label={`Activate ${row.name}`} onClick={() => activateYear(row)} />}
          {canManage && row.status === 'ACTIVE' && <IconAction icon={Lock} label={`Close ${row.name}`} danger onClick={() => setDialog({ type: 'close', year: row })} />}
          {isSuperAdmin && row.status === 'CLOSED' && <IconAction icon={LockOpen} label={`Reopen ${row.name}`} onClick={() => setDialog({ type: 'reopen', year: row })} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <RecordTable title="Fiscal Years" description="Only one year is active at a time. Closing a year makes all its data read-only." addLabel="Add Fiscal Year" onAdd={canManage ? () => setDialog({ type: 'edit' }) : null} columns={columns} rows={years} isLoading={isLoading} error={error} emptyText="No fiscal years yet." />

      {dialog?.type === 'edit' && <RecordDialog title={dialog.year ? 'Edit Fiscal Year' : 'Add Fiscal Year'} description="It starts in planning, so you can prepare it before it goes live." fields={YEAR_FIELDS} record={dialog.year} defaults={dialog.year ? undefined : nextFiscalYear(years)} mutation={save} onClose={() => setDialog(null)} />}
      {dialog?.type === 'close' && <RecordDialog title={`Close ${dialog.year.name}`} description="All its data becomes read-only, and only a Super Admin can reopen it." fields={REASON_FIELDS} mutation={{ ...close, mutate: ({ values }, options) => close.mutate({ id: dialog.year.id, values }, options) }} submitLabel="Close Year" successMessage="Fiscal year closed." onClose={() => { close.reset(); setDialog(null); }} />}
      {dialog?.type === 'reopen' && <RecordDialog title={`Reopen ${dialog.year.name}`} description="Its data becomes editable again and it becomes the active year." fields={REASON_FIELDS} mutation={{ ...reopen, mutate: ({ values }, options) => reopen.mutate({ id: dialog.year.id, values }, options) }} submitLabel="Reopen Year" successMessage="Fiscal year reopened." onClose={() => { reopen.reset(); setDialog(null); }} />}
    </>
  );
};

export default YearsTable;
