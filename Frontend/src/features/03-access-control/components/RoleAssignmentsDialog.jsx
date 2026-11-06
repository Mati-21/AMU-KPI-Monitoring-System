import { useState } from 'react';
import { X } from 'lucide-react';
import { useSelector } from 'react-redux';

import CustomSelect from '../../../shared/components/ui/CustomSelect';
import { formatEthiopianDate } from '../../../shared/lib/ethiopianDate';
import { useCan } from '../hooks/useCan';
import { ConfirmDialog, Field, FormDialog } from '../../02-offices/components/FormParts';
import { useNotification } from '../../09-notifications/context/NotificationContext';
import { useAssignRole, useRevokeRole, useRolesQuery } from '../hooks/useRoles';
import { assignmentPeriod, scopeLabel } from '../lib/roleAssignments';

/**
 * The roles a person has through one placement, with the form to give another.
 */
const RoleAssignmentsDialog = ({ placement, officeName, personName, onClose }) => {
  const can = useCan();
  const { notify } = useNotification();
  const isSuperAdmin = useSelector((state) => state.auth.user?.isSuperAdmin);
  const { data: roles = [] } = useRolesQuery();
  const assign = useAssignRole();
  const revoke = useRevokeRole();
  const [roleId, setRoleId] = useState('');
  const [wholeUniversity, setWholeUniversity] = useState(false);
  const [revoking, setRevoking] = useState(null);

  const roleOptions = roles.filter((role) => isSuperAdmin || !role.isSystem).map((role) => ({ value: role.id, label: role.name }));

  const submit = (event) => {
    event.preventDefault();
    assign.mutate(
      { placementId: placement.id, values: { roleId, ...(wholeUniversity && { scopeOfficeId: null }) } },
      {
        onSuccess: () => {
          notify('Role assigned.', 'success');
          onClose();
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
        <p className="text-sm text-muted-foreground">
          {wholeUniversity ? 'The role will apply to the whole university.' : `The role applies to ${officeName} and every office below it.`}
        </p>
        {isSuperAdmin && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={wholeUniversity} onChange={(event) => setWholeUniversity(event.target.checked)} />
            Apply to the whole university instead
          </label>
        )}
        <p className="text-sm text-muted-foreground">The role starts today, {formatEthiopianDate(new Date())}, and lasts until you revoke it.</p>
      </FormDialog>

      <ConfirmDialog open={Boolean(revoking)} onClose={closeRevoke} title="Revoke Role" description={`Take "${revoking?.role.name}" away from ${personName}? They lose its access straight away.`} onConfirm={confirmRevoke} error={revoke.error} pending={revoke.isPending} confirmLabel="Revoke" />
    </>
  );
};

export default RoleAssignmentsDialog;
