import { useState } from 'react';

import { Input } from '../../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../../02-offices/components/FormParts';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useSaveRole } from '../../hooks/useRoles';

function AddRole({ onClose, onSaved }) {
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
    <FormDialog open onClose={onClose} title="Add Role" description="Name a role after the access it gives, such as College Leadership, not after a job title." onSubmit={submit} error={save.error} pending={save.isPending}>
      <Field label="Role Name" required>
        <Input required aria-label="Role name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Description">
        <Input aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
    </FormDialog>
  );
}

export default AddRole;
