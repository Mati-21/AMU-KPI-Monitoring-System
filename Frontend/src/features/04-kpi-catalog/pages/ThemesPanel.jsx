import { useState } from 'react';
import { Edit3, Plus, Power } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import RecordDialog from '../components/RecordDialog';
import RecordTable, { IconAction } from '../components/RecordTable';
import { useSaveRecord, useThemeTree } from '../hooks/useCatalog';
import { numberThemes, themeOptions } from '../lib/kpiRules';

const NO_PARENT = '';

const themeFields = (tree, record) => [
  { key: 'name', label: 'Name', required: true },
  { key: 'code', label: 'Code' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'sortOrder', label: 'Order in the list', type: 'number', step: 1, hint: 'Lower numbers show first.' },
  { key: 'parentThemeId', label: 'Under Theme', type: 'select', placeholder: 'Top level', options: [{ value: NO_PARENT, label: 'Top level' }, ...themeOptions(tree, { except: record?.id })] },
];

const ThemesPanel = () => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: tree = [], isLoading, error } = useThemeTree();
  const save = useSaveRecord('kpi-themes');
  const [dialog, setDialog] = useState(null);
  const canManage = can('kpi:manage');

  const setActive = (theme) =>
    save.mutate(
      { id: theme.id, values: { isActive: !theme.isActive } },
      {
        onSuccess: () => notify(theme.isActive ? 'Theme deactivated.' : 'Theme activated.', 'success'),
        onError: (failure) => notify(apiErrorMessage(failure, 'Could not change this theme.'), 'error'),
      }
    );

  const columns = [
    { label: 'No', render: (row) => row.number },
    {
      label: 'Theme',
      render: (row) => (
        <span className={`font-medium ${row.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`} style={{ paddingLeft: `${row.depth * 20}px` }}>
          {row.name}
        </span>
      ),
    },
    { label: 'Code', render: (row) => row.code || '-' },
    { label: 'Description', render: (row) => row.description || '-' },
    { label: 'KPIs', render: (row) => row.kpiCount },
    { label: 'Status', render: (row) => <Badge variant="outline">{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    ...(canManage
      ? [
          {
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-2">
                {row.isActive && <IconAction icon={Plus} label={`Add sub-theme under ${row.name}`} onClick={() => setDialog({ defaults: { parentThemeId: row.id } })} />}
                <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ record: row })} />
                <IconAction icon={Power} label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`} danger={row.isActive} onClick={() => setActive(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <RecordTable title="Themes and Sub-Themes" description="How KPIs are grouped. Use + on a theme to add a sub-theme under it." addLabel="Add Theme" onAdd={canManage ? () => setDialog({}) : null} columns={columns} rows={numberThemes(tree)} isLoading={isLoading} error={error} />
      {dialog && <RecordDialog title={dialog.record ? 'Edit Theme' : 'Add Theme'} description="A theme groups related KPIs." fields={themeFields(tree, dialog.record)} record={dialog.record} defaults={dialog.defaults} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default ThemesPanel;
