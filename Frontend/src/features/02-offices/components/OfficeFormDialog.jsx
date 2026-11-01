import { useState } from 'react';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { Input } from '../../../shared/components/ui/Input';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useSaveOffice } from '../hooks/useOffices';
import { findOffice, officeOptions } from '../lib/officeTree';
import { Field, FormDialog } from './FormParts';

/**
 * Creates an office, or edits one when `office` is given. Only types deeper than the parent are offered,
 * which is the same rule the backend enforces.
 */
const OfficeFormDialog = ({ office, defaultParentId, tree, types, onClose, onSaved }) => {
  const { notify } = useNotification();
  const save = useSaveOffice();
  const isRoot = office ? !office.parentOfficeId : tree.length === 0;
  const [form, setForm] = useState({
    name: office?.name ?? '',
    code: office?.code ?? '',
    officeTypeId: office?.officeTypeId ?? '',
    parentOfficeId: office?.parentOfficeId ?? defaultParentId ?? '',
    canAssignKpi: office?.canAssignKpi ?? true,
    reason: '',
  });
  const set = (field) => (value) => setForm({ ...form, [field]: value });

  const parentLevel = findOffice(tree, form.parentOfficeId)?.officeType?.levelOrder;
  const typeOptions = types.filter((type) => isRoot || parentLevel == null || type.levelOrder == null || type.levelOrder > parentLevel).map((type) => ({ value: type.id, label: type.name }));
  const typeStillFits = typeOptions.some((option) => option.value === form.officeTypeId);
  const moved = office && form.parentOfficeId !== office.parentOfficeId;

  const submit = (event) => {
    event.preventDefault();
    const { reason, parentOfficeId, ...values } = form;
    save.mutate(
      { id: office?.id, values: { ...values, ...(!isRoot && { parentOfficeId }), ...(moved && reason.trim() && { reason }) } },
      {
        onSuccess: (saved) => {
          notify(office ? 'Office saved.' : 'Office created.', 'success');
          onSaved(saved.id);
        },
      }
    );
  };

  return (
    <FormDialog
      open
      onClose={onClose}
      title={office ? `Edit ${office.name}` : 'Add Office'}
      description={office ? 'Change the details or move this office under another one.' : 'Add an office to the university structure.'}
      onSubmit={submit}
      error={save.error}
      pending={save.isPending}
      submitDisabled={!typeStillFits || (!isRoot && !form.parentOfficeId)}
    >
      <Field label="Name" required>
        <Input required value={form.name} onChange={(event) => set('name')(event.target.value)} />
      </Field>
      <Field label="Code">
        <Input value={form.code} onChange={(event) => set('code')(event.target.value)} placeholder="For example, CNS" />
      </Field>
      {!isRoot && (
        <Field label="Parent Office" required group>
          <CustomSelect compact options={officeOptions(tree, { except: office?.id })} value={form.parentOfficeId} onChange={set('parentOfficeId')} placeholder="Choose the parent office" />
        </Field>
      )}
      <Field label="Office Type" required group hint={typeOptions.length === 0 ? 'No office type fits under this parent. Add one in the Office Types tab.' : !typeStillFits && form.officeTypeId ? 'The current type cannot sit under this parent. Choose another.' : undefined}>
        <CustomSelect compact options={typeOptions} value={typeStillFits ? form.officeTypeId : ''} onChange={set('officeTypeId')} placeholder="Choose the type" />
      </Field>
      {moved && (
        <Field label="Why is it moving?">
          <Input value={form.reason} onChange={(event) => set('reason')(event.target.value)} placeholder="Kept in the office history" />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={form.canAssignKpi} onChange={(event) => set('canAssignKpi')(event.target.checked)} />
        This office can assign KPIs to offices below it
      </label>
    </FormDialog>
  );
};

export default OfficeFormDialog;
