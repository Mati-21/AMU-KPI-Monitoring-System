import { useState } from 'react';
import { X } from 'lucide-react';
import { useSelector } from 'react-redux';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import EthiopianDateInput from '../../../shared/components/ui/EthiopianDateInput';
import { useCan } from '../hooks/useCan';
import { ConfirmDialog, Field, FormDialog } from '../../02-offices/components/FormParts';
import { useOfficeTree } from '../../02-offices/hooks/useOffices';
import { officeOptions, todayIso } from '../../02-offices/lib/officeTree';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useAssignRole, useRevokeRole, useRolesQuery } from '../hooks/useRoles';
import { assignmentPeriod, scopeLabel } from '../lib/roleAssignments';

const WHOLE_UNIVERSITY = 'university';

/**
 * The roles a person has through one placement, with the form to give another.
 */
const RoleAssignmentsDialog = ({ placement, officeName, personName, onClose }) => {
  const can = useCan();
  const { notify } = useNotification();
  const isSuperAdmin = useSelector((state) => state.auth.user?.isSuperAdmin);
  const { data: roles = [] } = useRolesQuery();
  const { data: tree } = useOfficeTree();
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const [roleId, setRoleId] = useState('');
  const [scope, setScope] = useState(placement.officeId);
  const [validFrom, setValidFrom] = useState(todayIso());
  const [validTo, setValidTo] = useState('');
  const [revoking, setRevoking] = useState(null);

  const roleOptions = roles.filter((role) => isSuperAdmin || !role.isSystem).map((role) => ({ value: role.id, label: role.name }));
  const scopeOptions = [{ value: WHOLE_UNIVERSITY, label: 'Whole university' }, ...officeOptions(tree)];

  const submit = (event) => {
    event.preventDefault();
    assign.mutate(
      { placementId: placement.id, values: { roleId, scopeOfficeId: scope === WHOLE_UNIVERSITY ? null : scope, validFrom, ...(validTo && { validTo }) } },
      {
        onSuccess: () => {
          notify('Role assigned.', 'success');
          setRoleId('');
          setValidTo('');
        },
      }
    );
  };

  const closeRevoke = () => {
    revoke.reset();
    setRevoking(null);
  };

  const confirmRevoke = () =>
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        notify('Role revoked.', 'success');
        closeRevoke();
      },
    });

  return (
    <>
      <FormDialog open onClose={onClose} title="Manage Roles" description={`${personName} in ${officeName}. A role gives access to its office and every office below it.`} onSubmit={submit} error={assign.error} pending={assign.isPending} submitLabel="Assign Role" submitDisabled={!roleId}>
        <div className="space-y-2">
          {placement.roles.length === 0 && <p className="text-sm text-muted-foreground">No role yet.</p>}
          {placement.roles.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{assignment.role.name}</p>
                <p className="text-xs text-muted-foreground">
                  {scopeLabel(assignment)} · {assignmentPeriod(assignment)}
                </p>
              </div>
              {can('role:assign') && (
                <button type="button" onClick={() => setRevoking(assignment)} aria-label={`Revoke ${assignment.role.name}`} title="Revoke role" className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Field label="Role" required group hint={roles.length === 0 ? 'There are no roles yet. Create one in Role Management first.' : undefined}>
          <CustomSelect compact options={roleOptions} value={roleId} onChange={setRoleId} placeholder="Choose a role" />
        </Field>
        <Field label="Applies To" required group>
          <CustomSelect compact options={scopeOptions} value={scope} onChange={setScope} placeholder="Choose where it applies" />
        </Field>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Start Date" required group>
            <EthiopianDateInput label="Start date" required value={validFrom} onChange={setValidFrom} />
          </Field>
          <Field label="End Date" group hint="Leave empty if it has no planned end.">
            <EthiopianDateInput label="End date" min={validFrom} value={validTo} onChange={setValidTo} />
          </Field>
        </div>
      </FormDialog>

      <ConfirmDialog open={Boolean(revoking)} onClose={closeRevoke} title="Revoke Role" description={`Take "${revoking?.role.name}" away from ${personName}? They lose its access straight away.`} onConfirm={confirmRevoke} error={revoke.error} pending={revoke.isPending} confirmLabel="Revoke" />
    </>
  );
};

export default RoleAssignmentsDialog;
