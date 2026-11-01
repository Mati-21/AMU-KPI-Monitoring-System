import { useState } from 'react';
import { Edit3, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { ConfirmDialog } from '../../02-offices/components/FormParts';
import { formatDate } from '../../02-offices/lib/officeTree';
import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import RecordTable, { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { useFrequencies } from '../../04-kpi-catalog/hooks/useCatalog';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { optionLabel } from '../../10-system/lib/settingValues';
import { useDeletePeriod, useGeneratePeriods, usePeriodStatus, usePeriods, useSavePeriod } from '../hooks/usePlanning';

const periodFields = (frequencies, isNew) => [
  ...(isNew ? [{ key: 'frequencyId', label: 'Frequency', type: 'select', required: true, options: frequencies.map((frequency) => ({ value: frequency.id, label: frequency.name })) }] : []),
  { key: 'name', label: 'Name', required: true },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date', required: true },
  { key: 'submissionDeadline', label: 'Submission Deadline', type: 'date', hint: isNew ? 'Left empty, it follows Submission window in Configuration.' : undefined },
  { key: 'isYearEnd', label: 'This period takes the final report of the year', type: 'checkbox' },
];

const REOPEN_FIELDS = [{ key: 'reason', label: 'Reason', type: 'textarea', required: true, hint: 'Kept in the system logs.' }];

const PeriodsTable = ({ year }) => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: periods = [], isLoading, error } = usePeriods(year.id);
  const { data: frequencies = [] } = useFrequencies();
  const save = useSavePeriod();
  const generate = useGeneratePeriods();
  const close = usePeriodStatus('close');
  const reopen = usePeriodStatus('reopen');
  const remove = useDeletePeriod();
  const [frequencyId, setFrequencyId] = useState('');
  const [dialog, setDialog] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canManage = can('period:manage') && year.status !== 'CLOSED';
  const generated = frequencies.filter((frequency) => !frequency.isCustom);

  const runGenerate = () =>
    generate.mutate(
      { fiscalYearId: year.id, frequencyId },
      {
        onSuccess: (created) => {
          notify(`${created.length} period(s) created.`, 'success');
          setFrequencyId('');
        },
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not create the periods.'), 'error'),
      }
    );

  const closePeriod = (period) =>
    close.mutate(
      { id: period.id },
      {
        onSuccess: () => notify(`${period.name} closed.`, 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not close this period.'), 'error'),
      }
    );

  const closeDelete = () => {
    remove.reset();
    setDeleting(null);
  };

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify('Period deleted.', 'success');
        closeDelete();
      },
    });

  const columns = [
    {
      label: 'Period',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
          {row.name}
          {row.isYearEnd && <Badge variant="outline">Year-end</Badge>}
        </span>
      ),
    },
    { label: 'Frequency', render: (row) => row.frequency.name },
    { label: 'Start', render: (row) => formatDate(row.startDate) },
    { label: 'End', render: (row) => formatDate(row.endDate) },
    { label: 'Deadline', render: (row) => formatDate(row.submissionDeadline) || '-' },
    { label: 'Status', render: (row) => <Badge variant="outline">{optionLabel(row.phase)}</Badge> },
    ...(canManage
      ? [
          {
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                {!row.isClosed && <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ type: 'edit', period: row })} />}
                {!row.isClosed && <IconAction icon={Lock} label={`Close ${row.name}`} onClick={() => closePeriod(row)} />}
                {row.isClosed && <IconAction icon={LockOpen} label={`Reopen ${row.name}`} onClick={() => setDialog({ type: 'reopen', period: row })} />}
                <IconAction icon={Trash2} label={`Delete ${row.name}`} danger onClick={() => setDeleting(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {canManage && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <span className="text-sm font-medium text-foreground">Create all periods for one frequency:</span>
          <div className="w-52">
            <CustomSelect compact options={generated.map((frequency) => ({ value: frequency.id, label: frequency.name }))} value={frequencyId} onChange={setFrequencyId} placeholder="Choose a frequency" />
          </div>
          <Button type="button" size="sm" disabled={!frequencyId || generate.isPending} onClick={runGenerate}>
            {generate.isPending ? 'Creating...' : 'Create Periods'}
          </Button>
          <Button type="button" size="sm" variant="outline" className="ml-auto gap-1" onClick={() => setDialog({ type: 'edit' })}>
            <Plus className="h-4 w-4" />
            Add One Period
          </Button>
        </div>
      )}

      <RecordTable title={`Reporting Periods of ${year.name}`} description={year.status === 'CLOSED' ? 'This year is closed, so its periods are read-only.' : 'When offices report, and by which deadline.'} columns={columns} rows={periods} isLoading={isLoading} error={error} emptyText="No periods yet." />

      {dialog?.type === 'edit' && <RecordDialog title={dialog.period ? `Edit ${dialog.period.name}` : 'Add Period'} description="Once reports depend on a period, only its deadline can change." fields={periodFields(frequencies, !dialog.period)} record={dialog.period} mutation={dialog.period ? save : { ...save, mutate: ({ values }, options) => save.mutate({ values: { ...values, fiscalYearId: year.id } }, options) }} onClose={() => { save.reset(); setDialog(null); }} />}
      {dialog?.type === 'reopen' && <RecordDialog title={`Reopen ${dialog.period.name}`} description="Offices can work on it again." fields={REOPEN_FIELDS} mutation={{ ...reopen, mutate: ({ values }, options) => reopen.mutate({ id: dialog.period.id, values }, options) }} submitLabel="Reopen" successMessage="Period reopened." onClose={() => { reopen.reset(); setDialog(null); }} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={closeDelete} title="Delete Period" description={`Delete "${deleting?.name}"? A period with reports or results cannot be deleted.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />
    </div>
  );
};

export default PeriodsTable;
