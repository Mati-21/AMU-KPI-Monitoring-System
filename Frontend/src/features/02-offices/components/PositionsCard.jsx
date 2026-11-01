import { useState } from 'react';
import { Briefcase, Edit3, Plus, Trash2 } from 'lucide-react';

import { Badge } from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/components/ui/Card';
import { Input } from '../../../shared/components/ui/Input';
import { useCan } from '../../03-access-control/hooks/useCan';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useDeletePosition, useSavePosition } from '../hooks/useOffices';
import { ConfirmDialog, Field, FormDialog } from './FormParts';
import PreviewList from './PreviewList';

const PositionDialog = ({ officeId, position, onClose }) => {
  const { notify } = useNotification();
  const save = useSavePosition();
  const [title, setTitle] = useState(position?.title ?? '');
  const [isHead, setIsHead] = useState(position?.isHead ?? false);

  const submit = (event) => {
    event.preventDefault();
    save.mutate(
      { id: position?.id, officeId, values: { title, isHead } },
      {
        onSuccess: () => {
          notify('Position saved.', 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title={position ? 'Edit Position' : 'Add Position'} description="A position is a job in this office, such as Dean or Lecturer." onSubmit={submit} error={save.error} pending={save.isPending}>
      <Field label="Title" required>
        <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={isHead} onChange={(event) => setIsHead(event.target.checked)} />
        This position heads the office (one holder at a time)
      </label>
    </FormDialog>
  );
};

const PositionRow = ({ position, canManage, onEdit, onDelete }) => (
  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        {position.title}
        {position.isHead && <Badge variant="outline">Head</Badge>}
      </p>
      <p className="text-xs text-muted-foreground">{position.holderCount} current holder(s)</p>
    </div>
    {canManage && (
      <div className="flex shrink-0 gap-1">
        <button type="button" onClick={() => onEdit(position)} aria-label={`Edit ${position.title}`} className="rounded p-1 text-primary hover:bg-primary/10">
          <Edit3 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onDelete(position)} aria-label={`Delete ${position.title}`} className="rounded p-1 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    )}
  </div>
);

const PositionsCard = ({ office }) => {
  const can = useCan();
  const { notify } = useNotification();
  const remove = useDeletePosition();
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
        notify('Position deleted.', 'success');
        closeDelete();
      },
    });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="h-4 w-4 text-primary" />
          Positions ({office.positions.length})
        </CardTitle>
        {canManage && office.isActive && (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {office.positions.length === 0 && <p className="text-sm text-muted-foreground">No positions yet.</p>}
        <PreviewList title="Positions" items={office.positions} searchText={(position) => position.title} renderRow={(position) => <PositionRow position={position} canManage={canManage} onEdit={setEditing} onDelete={setDeleting} />} />
      </CardContent>

      {editing && <PositionDialog officeId={office.id} position={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={closeDelete} title="Delete Position" description={`Delete "${deleting?.title}"? A position someone has held is kept as history.`} onConfirm={confirmDelete} error={remove.error} pending={remove.isPending} />
    </Card>
  );
};

export default PositionsCard;
