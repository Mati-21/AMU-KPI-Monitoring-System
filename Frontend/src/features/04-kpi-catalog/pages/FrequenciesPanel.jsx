import { useState } from 'react';
import { Edit3 } from 'lucide-react';

import { useCan } from '../../03-access-control/hooks/useCan';
import RecordDialog from '../components/RecordDialog';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useFrequencies, useSaveRecord } from '../hooks/useCatalog';

const FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'isCustom', label: 'Custom dates, with periods set by hand', type: 'checkbox' },
  { key: 'intervalMonths', label: 'Months Between Reports', type: 'number', required: true, min: 1, max: 12, step: 1, visible: (form) => !form.isCustom, hint: 'For example 3 for quarterly. It cannot change once periods use it.' },
];

const FrequenciesPanel = () => {
  const can = useCan();
  const { data: frequencies = [], isLoading, error } = useFrequencies();
  const save = useSaveRecord('reporting-frequencies');
  const [dialog, setDialog] = useState(null);
  const canManage = can('kpi:manage');

  const columns = [
    { label: 'Name', render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { label: 'Interval', render: (row) => (row.isCustom ? 'Custom dates' : `Every ${row.intervalMonths} month(s)`) },
    ...(canManage ? [{ label: 'Actions', render: (row) => <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ record: row })} /> }] : []),
  ];

  return (
    <>
      <RecordTable title="Reporting Frequencies" description="How often offices report on a KPI." addLabel="Add Frequency" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={frequencies} isLoading={isLoading} error={error} />
      {dialog && <RecordDialog title={dialog.record ? 'Edit Frequency' : 'Add Frequency'} description="Reporting periods are generated from this." fields={FIELDS} record={dialog.record} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default FrequenciesPanel;
