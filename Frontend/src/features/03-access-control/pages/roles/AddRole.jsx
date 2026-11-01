import { useState } from 'react';

import Button from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useSaveRole } from '../../hooks/useRoles';

function AddRole({ onCancel, onSaved }) {
  const { notify } = useNotification();
  const save = useSaveRole();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = (event) => {
    event.preventDefault();
    save.mutate(
      { values: { name, ...(description.trim() && { description }) } },
      {
        onSuccess: (role) => {
          notify('Role created. Choose what it may do next.', 'success');
          onSaved(role);
        },
      }
    );
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-5 rounded-2xl border border-border bg-muted/50 p-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Add Role</h2>
        <p className="mt-1 text-xs text-muted-foreground">Name a role after the access it gives, such as College Leadership, not after a job title.</p>
      </div>

      {save.error && <p className="text-sm text-red-500">{apiErrorMessage(save.error, 'Could not save this role.')}</p>}

      <Input required aria-label="Role name" placeholder="Enter Role" value={name} onChange={(event) => setName(event.target.value)} />
      <Input aria-label="Description" placeholder="Enter Description" value={description} onChange={(event) => setDescription(event.target.value)} />

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default AddRole;
