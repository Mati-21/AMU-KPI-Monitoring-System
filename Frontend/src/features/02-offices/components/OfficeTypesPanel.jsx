import { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';

import Button from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../shared/components/ui/Table';
import { apiErrorMessage } from '../../../shared/lib/apiError';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useDeleteOfficeType, useOfficeTypes, useSaveOfficeType } from '../hooks/useOffices';
import { ConfirmDialog, Field, FormDialog } from './FormParts';

const OfficeTypeDialog = ({ officeType, onClose }) => {
  const { notify } = useNotification();
  const save = useSaveOfficeType();
  const [form, setForm] = useState({ name: officeType?.name ?? '', description: officeType?.description ?? '', levelOrder: officeType?.levelOrder ?? '' });
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    save.mutate(
      { id: officeType?.id, values: { ...form, levelOrder: Number(form.levelOrder) } },
      {
        onSuccess: () => {
          notify('Office type saved.', 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title={officeType ? 'Edit Office Type' : 'Add Office Type'} description="A level in the university structure, such as College or Department." onSubmit={submit} error={save.error} pending={save.isPending}>
      <Field label="Name" required>
        <Input required value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Level" required hint="1 is the top. An office can only sit under an office with a smaller level number.">
        <Input type="number" min={1} step={1} required value={form.levelOrder} onChange={set('levelOrder')} />
      </Field>
      <Field label="Description">
        <Input value={form.description} onChange={set('description')} />
      </Field>
    </FormDialog>
  );
};

const OfficeTypesPanel = () => {
  const can = useCan();
  const { notify } = useNotification();
  const { data: types = [], isLoading, error } = useOfficeTypes();
  const remove = useDeleteOfficeType();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canManage = can('office:manage');

  const closeDelete = () => {
    remove.reset();
    setDeleting(null);
  };

  const confirmDelete = () =>
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify('Office type deleted.', 'success');
        closeDelete();
      },
    });

  return (
    <div className="flex-1 rounded-lg border border-border bg-card">
      {canManage && (
        <div className="flex justify-end border-b border-border p-4">
          <Button type="button" className="gap-2" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" />
            Add Office Type
          </Button>
        </div>
      )}
      {error && <p className="p-4 text-sm text-red-500">{apiErrorMessage(error, 'Could not load office types.')}</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Offices</TableHead>
              {canManage && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5}>Loading...</TableCell>
              </TableRow>
            )}
            {types.map((type) => (
              <TableRow key={type.id}>
                <TableCell>{type.levelOrder ?? '-'}</TableCell>
                <TableCell className="font-medium text-foreground">{type.name}</TableCell>
                <TableCell>{type.description || '-'}</TableCell>
                <TableCell>{type.officeCount}</TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setEditing(type)} aria-label={`Edit ${type.name}`} className="rounded p-1 text-primary hover:bg-primary/10">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setDeleting(type)} aria-label={`Delete ${type.name}`} className="rounded p-1 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && <OfficeTypeDialog officeType={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={closeDelete} title="Delete Office Type" description={`Delete "${deleting?.name}"? A type used by any office cannot be deleted.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />
    </div>
  );
};

export default OfficeTypesPanel;
