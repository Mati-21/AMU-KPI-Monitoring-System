import { useState } from 'react';
import { ArrowLeft, Building2, KeyRound, Laptop, Save, ShieldCheck, User } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '../../../../shared/components/ui/Badge';
import Button from '../../../../shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../shared/components/ui/Card';
import { Input } from '../../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import PlaceMemberDialog from '../../../02-offices/components/PlaceMemberDialog';
import RoleAssignmentsDialog from '../../../03-access-control/components/RoleAssignmentsDialog';
import { useCan } from '../../../03-access-control/hooks/useCan';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import PersonAvatar from '../../components/PersonAvatar';
import { PlacementsCard } from '../../components/profile/AboutCards';
import { useAccountSessions, useEnforceMfa, usePerson, useResetPassword, useRevokeAccountSessions, useSaveAccount, useSetAccountActive, useUpdatePerson } from '../../hooks/useUsers';

const MIN_PASSWORD_LENGTH = 8;
const EDITABLE_FIELDS = ['firstName', 'middleName', 'lastName', 'email', 'phone'];

const Field = ({ label, ...props }) => (
  <label className="block space-y-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <Input {...props} />
  </label>
);

const useActionNotes = () => {
  const { notify } = useNotification();
  return (message) => ({
    onSuccess: () => notify(message, 'success'),
    onError: (error) => notify(apiErrorMessage(error), 'error'),
  });
};

const DetailsCard = ({ person, canEdit }) => {
  const update = useUpdatePerson();
  const notes = useActionNotes();
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, person[field] ?? ''])));
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const save = (event) => {
    event.preventDefault();
    update.mutate({ personId: person.id, values: form }, notes('Details saved.'));
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" />
          Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="First name" required disabled={!canEdit} value={form.firstName} onChange={set('firstName')} />
          <Field label="Middle name" disabled={!canEdit} value={form.middleName} onChange={set('middleName')} />
          <Field label="Last name" required disabled={!canEdit} value={form.lastName} onChange={set('lastName')} />
          <Field label="Staff number" disabled readOnly value={person.staffNumber ?? ''} />
          <Field label="Email" type="email" disabled={!canEdit} value={form.email} onChange={set('email')} />
          <Field label="Phone" type="tel" disabled={!canEdit} value={form.phone} onChange={set('phone')} />
          {canEdit && (
            <div className="sm:col-span-2">
              <Button type="submit" className="gap-2" disabled={update.isPending}>
                <Save className="h-4 w-4" />
                {update.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

const CreateLoginForm = ({ person }) => {
  const save = useSaveAccount();
  const { notify } = useNotification();
  const [username, setUsername] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) return notify(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'warning');
    return save.mutate(
      { personId: person.id, values: { username, temporaryPassword } },
      { onSuccess: () => notify('Login created.', 'success'), onError: (error) => notify(apiErrorMessage(error), 'error') }
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">This person has no login yet.</p>
      <Field label="Username" required autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} />
      <Field label="Temporary password" type="password" required autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
      <Button type="submit" disabled={save.isPending}>
        Create Login
      </Button>
    </form>
  );
};

const AccountActions = ({ account }) => {
  const setActive = useSetAccountActive();
  const enforceMfa = useEnforceMfa();
  const reset = useResetPassword();
  const revoke = useRevokeAccountSessions();
  const notes = useActionNotes();
  const { notify } = useNotification();
  // Requiring MFA is a Super Admin action on the backend
  const isSuperAdmin = useSelector((state) => state.auth.user?.isSuperAdmin);
  const { data: sessions = [] } = useAccountSessions(account.id);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const submitReset = (event) => {
    event.preventDefault();
    if (temporaryPassword.length < MIN_PASSWORD_LENGTH) return notify(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'warning');
    return reset.mutate({ accountId: account.id, temporaryPassword }, { ...notes('Password reset. They must change it when they next sign in.'), onSettled: () => setTemporaryPassword('') });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{account.username}</span>
        <Badge variant="outline">{account.isActive ? 'Active' : 'Deactivated'}</Badge>
        <Badge variant="outline">{account.mfaEnabled ? 'MFA on' : 'MFA off'}</Badge>
        {account.mfaEnforced && <Badge variant="outline">MFA required</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={account.isActive ? 'destructive' : 'default'} disabled={setActive.isPending} onClick={() => setActive.mutate({ accountId: account.id, isActive: !account.isActive }, notes(account.isActive ? 'Login deactivated.' : 'Login activated.'))}>
          {account.isActive ? 'Deactivate Login' : 'Activate Login'}
        </Button>
        {isSuperAdmin && (
          <Button type="button" size="sm" variant="outline" className="gap-1" disabled={enforceMfa.isPending} onClick={() => enforceMfa.mutate({ accountId: account.id, enforced: !account.mfaEnforced }, notes('MFA requirement updated.'))}>
            <ShieldCheck className="h-4 w-4" />
            {account.mfaEnforced ? 'Stop Requiring MFA' : 'Require MFA'}
          </Button>
        )}
      </div>

      <form onSubmit={submitReset} className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Field label="New temporary password" type="password" required autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
        </div>
        <Button type="submit" size="sm" variant="outline" className="gap-1" disabled={reset.isPending}>
          <KeyRound className="h-4 w-4" />
          Reset Password
        </Button>
      </form>

      <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Laptop className="h-4 w-4 text-muted-foreground" />
          {sessions.length} signed-in device(s)
        </p>
        {sessions.length > 0 && (
          <Button type="button" size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(account.id, notes('Signed out of every device.'))}>
            Sign Out Everywhere
          </Button>
        )}
      </div>
    </div>
  );
};

const LoginCard = ({ person, canManage }) => (
  <Card className="border-border bg-card">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <KeyRound className="h-4 w-4 text-primary" />
        Login
      </CardTitle>
    </CardHeader>
    <CardContent>
      {!canManage && <p className="text-sm text-muted-foreground">{person.account ? `Username: ${person.account.username}` : 'No login yet.'}</p>}
      {canManage && (person.account ? <AccountActions account={person.account} /> : <CreateLoginForm person={person} />)}
    </CardContent>
  </Card>
);

const UserDetail = () => {
  const { personId } = useParams();
  const can = useCan();
  const { data: person, isLoading, error } = usePerson(personId);
  const [placing, setPlacing] = useState(false);
  const [managingRolesOf, setManagingRolesOf] = useState(null);
  const managedPlacement = person?.placements.find((placement) => placement.id === managingRolesOf);

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <main className="flex-1 min-w-0 p-6 space-y-6">
        <Link to="/user-management" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load this person.')}</p>}

        {person && (
          <>
            <div className="flex items-center gap-4">
              <PersonAvatar personId={person.id} fileId={person.profilePictureFileId} fullName={person.fullName} className="h-16 w-16 text-lg" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">{person.fullName}</h1>
                <p className="text-sm text-muted-foreground">{person.email || 'No email yet'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DetailsCard key={person.id} person={person} canEdit={can('user:update')} />
              <LoginCard person={person} canManage={can('user:manage')} />
              <PlacementsCard
                placements={person.placements}
                action={
                  can('office:assign') && person.isActive ? (
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setPlacing(true)}>
                      <Building2 className="h-4 w-4" />
                      Place in Office
                    </Button>
                  ) : null
                }
                placementAction={(placement) =>
                  can('role:assign') ? (
                    <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => setManagingRolesOf(placement.id)}>
                      <ShieldCheck className="h-4 w-4" />
                      Manage Roles
                    </Button>
                  ) : null
                }
              />
            </div>
            {placing && <PlaceMemberDialog person={person} onClose={() => setPlacing(false)} />}
            {managedPlacement && <RoleAssignmentsDialog placement={managedPlacement} officeName={managedPlacement.office.name} personName={person.fullName} onClose={() => setManagingRolesOf(null)} />}
          </>
        )}
      </main>
    </div>
  );
};

export default UserDetail;
