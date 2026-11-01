import { useState } from 'react';
import { Edit3 } from 'lucide-react';

import { useCan } from '../../03-access-control/hooks/useCan';
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
  const canManage = can('kpi:manage');

  const columns = [
    { label: 'Name', render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { label: 'Symbol', render: (row) => row.symbol || '-' },
    { label: 'Description', render: (row) => row.description || '-' },
    ...(canManage ? [{ label: 'Actions', render: (row) => <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ record: row })} /> }] : []),
  ];

  return (
    <>
      <RecordTable title="Measurement Units" description="What number KPIs count, such as students or publications. Percentages, ratios and money have their own measurement types, so they need no unit here. A unit in use by a KPI cannot be changed." addLabel="Add Unit" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={units} isLoading={isLoading} error={error} />
      {dialog && <RecordDialog title={dialog.record ? 'Edit Unit' : 'Add Unit'} description="Such as students, publications or kilometres." fields={FIELDS} record={dialog.record} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default UnitsPanel;
