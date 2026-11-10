import { useState } from 'react';
import { Edit3, Power } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import RecordDialog from '../../04-kpi-catalog/components/RecordDialog';
import RecordTable, { IconAction } from '../../04-kpi-catalog/components/RecordTable';
import { useDocumentTypes, useSaveDocumentType } from '../hooks/useDocuments';

const FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'allowedExtensions', label: 'Allowed File Types', hint: 'Separated by commas, such as pdf, xlsx. Left empty, every supported type is allowed.' },
  { key: 'maxSizeMb', label: 'Largest File (MB)', type: 'number', min: 1, step: 1, hint: 'Left empty, the system limit applies.' },
];

/**
 * What kinds of document the university accepts. A type that is retired stays on the documents already filed under it
 * but can no longer be chosen for a new upload.
 */
const DocumentTypesPanel = () => {
  const { data: types = [], isLoading, error } = useDocumentTypes();
  const save = useSaveDocumentType();
  const [dialog, setDialog] = useState(null);

  const columns = [
    { label: 'Name', render: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { label: 'Description', render: (row) => row.description || '-' },
    { label: 'Allowed Files', render: (row) => (row.allowedExtensions ? row.allowedExtensions.split(',').join(', ') : 'Any supported type') },
    { label: 'Largest File', render: (row) => (row.maxSizeMb ? `${row.maxSizeMb} MB` : 'System limit') },
    { label: 'Status', render: (row) => <Badge variant="outline">{row.isActive ? 'Active' : 'Retired'}</Badge> },
    {
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <IconAction icon={Edit3} label={`Edit ${row.name}`} onClick={() => setDialog({ record: row })} />
          <IconAction icon={Power} label={row.isActive ? `Retire ${row.name}` : `Restore ${row.name}`} onClick={() => save.mutate({ id: row.id, values: { isActive: !row.isActive } })} />
        </div>
      ),
    },
  ];

  return (
    <>
      <RecordTable title="Document Types" description="The kinds of document that can be uploaded, with the file types and size each accepts." addLabel="Add Document Type" onAdd={() => setDialog({})} columns={columns} rows={types} isLoading={isLoading} error={error || save.error} emptyText="No document types yet. Add one before anyone can upload." />
      {dialog && <RecordDialog title={dialog.record ? 'Edit Document Type' : 'Add Document Type'} description="Such as Financial Statement or Performance Evidence." fields={FIELDS} record={dialog.record} mutation={save} onClose={() => setDialog(null)} />}
    </>
  );
};

export default DocumentTypesPanel;
