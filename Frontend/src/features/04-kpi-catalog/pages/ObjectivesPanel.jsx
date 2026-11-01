import { useState } from 'react';
import { Edit3, Power } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import RecordDialog from '../components/RecordDialog';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useObjectives, useSaveRecord } from '../hooks/useCatalog';

const FIELDS = [
  { key: 'code', label: 'Code', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
];

const ObjectivesPanel = () => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: objectives = [], isLoading, error } = useObjectives();
  const save = useSaveRecord('strategic-objectives');
  const [dialog, setDialog] = useState(null);
  const canManage = can('kpi:manage');

  const setActive = (objective) =>
    save.mutate(
      { id: objective.id, values: { isActive: !objective.isActive } },
      {
        onSuccess: () => notify(objective.isActive ? 'Objective deactivated.' : 'Objective activated.', 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not change this objective.'), 'error'),
      }
    );

  const columns = [
    { label: 'Code', render: (row) => <span className="font-medium text-foreground">{row.code}</span> },
    { label: 'Name', render: (row) => row.name },
    { label: 'Description', render: (row) => row.description || '-' },
    { label: 'KPIs', render: (row) => row.kpiCount },
    { label: 'Status', render: (row) => <Badge variant="outline">{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage
      ? [
          {
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                <IconAction icon={Edit3} label={`Edit ${row.code}`} onClick={() => setDialog({ record: row })} />
                <IconAction icon={Power} label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.code}`} danger={row.isActive} onClick={() => setActive(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <RecordTable title="Strategic Objectives" description="The goals your KPIs serve. Every KPI belongs to one." addLabel="Add Objective" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={objectives} isLoading={isLoading} error={error} />
      {dialog && <RecordDialog title={dialog.record ? 'Edit Objective' : 'Add Objective'} description="A goal from the university's strategic plan." fields={FIELDS} record={dialog.record} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default ObjectivesPanel;
