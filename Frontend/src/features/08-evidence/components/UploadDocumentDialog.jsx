import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useOfficeList } from '../../02-offices/hooks/useOffices';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useDocumentTypes, useUploadDocument } from '../hooks/useDocuments';
import { describeType } from '../lib/documentRules';

/**
 * Upload a file with its description. The document type decides which files and sizes are accepted.
 */
const UploadDocumentDialog = ({ onClose }) => {
  const { notify } = useNotification();
  const upload = useUploadDocument();
  const { data: types = [] } = useDocumentTypes();
  const { data: offices = [] } = useOfficeList();
  const [form, setForm] = useState({ title: '', description: '', documentTypeId: '', ownerOfficeId: '' });
  const [file, setFile] = useState(null);

  const activeTypes = types.filter((type) => type.isActive);
  const activeOffices = offices.filter((office) => office.isActive);
  // With only one choice there is nothing to decide
  const documentTypeId = form.documentTypeId || (activeTypes.length === 1 ? activeTypes[0].id : '');
  const ownerOfficeId = form.ownerOfficeId || (activeOffices.length === 1 ? activeOffices[0].id : '');
  const chosenType = activeTypes.find((type) => type.id === documentTypeId);
  const set = (key) => (value) => setForm({ ...form, [key]: value });

  const submit = (event) => {
    event.preventDefault();
    upload.mutate(
      { file, documentTypeId, ownerOfficeId, title: form.title.trim(), description: form.description.trim() },
      {
        onSuccess: (saved) => {
          notify(`${saved.title} uploaded.`, 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title="Upload Document" description="The file's contents are checked against its type." onSubmit={submit} error={upload.error} pending={upload.isPending} submitLabel="Upload" submitDisabled={!file || !form.title.trim() || !documentTypeId || !ownerOfficeId}>
      <Field label="Title" required>
        <Input required value={form.title} onChange={(event) => set('title')(event.target.value)} placeholder="Q1 publication list" />
      </Field>
      <Field label="Document Type" required group hint={chosenType ? `Accepts ${describeType(chosenType)}.` : undefined}>
        <CustomSelect compact options={activeTypes.map((type) => ({ value: type.id, label: type.name }))} value={documentTypeId} onChange={set('documentTypeId')} placeholder="Choose document type" />
      </Field>
      <Field label="Office" required group hint="The office this document belongs to. Only offices you may upload for will accept it.">
        <CustomSelect compact options={activeOffices.map((office) => ({ value: office.id, label: office.name }))} value={ownerOfficeId} onChange={set('ownerOfficeId')} placeholder="Choose office" />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={form.description} onChange={(event) => set('description')(event.target.value)} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </Field>
      <Field label="File" required>
        <input type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground" />
      </Field>
    </FormDialog>
  );
};

export default UploadDocumentDialog;
