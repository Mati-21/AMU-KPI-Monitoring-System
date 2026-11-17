import { useState } from 'react';
import { Edit3, Trash2 } from 'lucide-react';

import { useCan } from '../../03-access-control/hooks/useCan';
import DeleteRecordDialog from '../components/DeleteRecordDialog';
import RecordDialog from '../components/RecordDialog';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useSaveRecord, useUnits } from '../hooks/useCatalog';

const FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'symbol', label: 'Symbol', hint: 'For example %, # or km.' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const UnitsPanel = () => {
  const can = useCan();
  const { data: units = [], isLoading, error } = useUnits();
  const save = useSaveRecord('measurement-units');
  const [dialog, setDialog] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canManage = can('kpi:manage');

  const columns = [
    { label: 'Name', render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { label: 'Symbol', render: (row) => row.symbol || '-' },
    { label: 'Description', render: (row) => row.description || '-' },
    ...(canManage ? [{ label: 'Actions', render: (row) => (
      <div className="flex gap-2">
        <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ record: row })} />
        <IconAction icon={Trash2} danger label={`Delete ${row.name}`} onClick={() => setDeleting(row)} />
      </div>
    ) }] : []),
  ];

  return (
    <>
      <RecordTable title="Measurement Units" description="What number KPIs count, such as students or publications. Percentages, ratios and money have their own measurement types, so they need no unit here. A unit in use by a KPI cannot be changed." addLabel="Add Unit" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={units} isLoading={isLoading} error={error} />
      {deleting && <DeleteRecordDialog path="measurement-units" id={deleting.id} title="Delete Unit" name={deleting.name} details="A unit that a KPI uses cannot be deleted." onClose={() => setDeleting(null)} />}
      {dialog && <RecordDialog title={dialog.record ? 'Edit Unit' : 'Add Unit'} description="Such as students, publications or kilometres." fields={FIELDS} record={dialog.record} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default UnitsPanel;
