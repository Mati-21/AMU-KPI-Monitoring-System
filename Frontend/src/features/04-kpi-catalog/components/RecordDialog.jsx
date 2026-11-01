import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { Field, FormDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';

const startValue = (field, record) => {
  const value = record?.[field.key];
  if (field.type === 'checkbox') return Boolean(value);
  if (value === null || value === undefined) return '';
  return field.type === 'date' ? String(value).slice(0, 10) : String(value);
};

const toSendValue = (field, value) => {
  if (field.type === 'checkbox') return value;
  if (value === '') return null;
  return field.type === 'number' ? Number(value) : value;
};

const Control = ({ field, value, onChange }) => {
  if (field.type === 'select') return <CustomSelect compact options={field.options} value={value} onChange={onChange} placeholder={field.placeholder ?? 'Choose'} />;
  if (field.type === 'textarea') return <textarea required={field.required} rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />;
  return <Input type={field.type ?? 'text'} required={field.required} min={field.min} max={field.max} step={field.step} value={value} onChange={(event) => onChange(event.target.value)} />;
};

/**
 * A small add or edit form built from a list of fields. An edit sends only what changed, because the
 * backend refuses some changes to records in use even when the value is the same.
 */
const RecordDialog = ({ title, description, fields, record, defaults, mutation, submitLabel, successMessage = 'Saved.', onClose }) => {
  const { notify } = useNotification();
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((field) => [field.key, startValue(field, record ?? defaults)])));
  const shown = fields.filter((field) => !field.visible || field.visible(form));
  const missingSelect = shown.some((field) => field.type === 'select' && field.required && !form[field.key]);

  const submit = (event) => {
    event.preventDefault();
    const entries = fields.map((field) => [field, shown.includes(field) ? toSendValue(field, form[field.key]) : null]);
    const values = Object.fromEntries(
      entries.filter(([field, value]) => (record ? value !== toSendValue(field, startValue(field, record)) : value !== null)).map(([field, value]) => [field.key, value])
    );
    if (record && Object.keys(values).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(
      { id: record?.id, values },
      {
        onSuccess: () => {
          notify(successMessage, 'success');
          onClose();
        },
      }
    );
  };

  return (
    <FormDialog open onClose={onClose} title={title} description={description} onSubmit={submit} error={mutation.error} pending={mutation.isPending} submitLabel={submitLabel} submitDisabled={missingSelect}>
      {shown.map((field) =>
        field.type === 'checkbox' ? (
          <label key={field.key} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })} />
            {field.label}
          </label>
        ) : (
          <Field key={field.key} label={field.label} required={field.required} hint={field.hint} group={field.type === 'select'}>
            <Control field={field} value={form[field.key]} onChange={(value) => setForm({ ...form, [field.key]: value })} />
          </Field>
        )
      )}
    </FormDialog>
  );
};

export default RecordDialog;
