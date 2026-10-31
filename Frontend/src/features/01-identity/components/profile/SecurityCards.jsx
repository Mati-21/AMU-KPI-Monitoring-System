import { useState } from 'react';
import { Laptop, Lock, ShieldCheck } from 'lucide-react';

import Button from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../shared/components/ui/Card';
import { Input } from '../../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useChangeMyPassword, useDisableMfa, useMySessions, useRevokeMyOtherSessions, useRevokeMySession, useStartMfaSetup, useVerifyMfaSetup } from '../../hooks/useProfile';

const MIN_PASSWORD_LENGTH = 8;

const LabelledInput = ({ label, ...props }) => (
  <label className="block space-y-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <Input {...props} />
  </label>
);

const codeOnly = (value) => value.replace(/\D/g, '');

export const PasswordCard = ({ mfaEnabled }) => {
  const { notify } = useNotification();
  const change = useChangeMyPassword();
  const empty = { currentPassword: '', newPassword: '', confirm: '', code: '' };
  const [form, setForm] = useState(empty);
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = (event) => {
    event.preventDefault();
    if (form.newPassword.length < MIN_PASSWORD_LENGTH) return notify(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 'warning');
    if (form.newPassword !== form.confirm) return notify('The new passwords do not match.', 'warning');
    const { confirm: _confirm, ...values } = form;
    return change.mutate(values, {
      onSuccess: ({ otherSessionsSignedOut }) => {
        setForm(empty);
        notify(`Password changed. ${otherSessionsSignedOut} other device(s) were signed out.`, 'success');
      },
      onError: (error) => notify(apiErrorMessage(error, 'Could not change your password.'), 'error'),
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <LabelledInput label="Current password" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} />
          <LabelledInput label="New password" type="password" autoComplete="new-password" required value={form.newPassword} onChange={set('newPassword')} />
          <LabelledInput label="Confirm new password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
          {mfaEnabled && <LabelledInput label="Authenticator code" inputMode="numeric" maxLength={6} required value={form.code} onChange={(event) => setForm({ ...form, code: codeOnly(event.target.value) })} />}
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Changing...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export const MfaCard = ({ user }) => {
  const { notify } = useNotification();
  const start = useStartMfaSetup();
  const verify = useVerifyMfaSetup();
  const disable = useDisableMfa();
  const [setup, setSetup] = useState(null);
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState('');
  const showError = (fallback) => (error) => notify(apiErrorMessage(error, fallback), 'error');

  const begin = () => start.mutate(undefined, { onSuccess: setSetup, onError: showError('Could not start the setup.') });

  const finish = (message) => () => {
    setSetup(null);
    setTurningOff(false);
    setCode('');
    notify(message, 'success');
  };

  const submit = (event) => {
    event.preventDefault();
    if (setup) verify.mutate(code, { onSuccess: finish('Two-factor authentication is on.'), onError: showError('That code is not valid.') });
    else disable.mutate(code, { onSuccess: finish('Two-factor authentication is off.'), onError: showError('That code is not valid.') });
  };

  const cancel = () => {
    setSetup(null);
    setTurningOff(false);
    setCode('');
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Two-Factor Authentication
        </CardTitle>
        <Badge variant="outline" className={user.mfaEnabled ? 'bg-green-500/10 text-green-600 border-green-500/30' : ''}>
          {user.mfaEnabled ? 'On' : 'Off'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {!setup && !turningOff && (
          <>
            <p className="text-sm text-muted-foreground">
              {user.mfaEnforced ? 'Required for your account by university policy.' : 'Adds a code from an authenticator app when you sign in.'}
            </p>
            {!user.mfaEnabled && (
              <Button type="button" onClick={begin} disabled={start.isPending}>
                Turn On
              </Button>
            )}
            {user.mfaEnabled && !user.mfaEnforced && (
              <Button type="button" variant="outline" onClick={() => setTurningOff(true)}>
                Turn Off
              </Button>
            )}
          </>
        )}

        {(setup || turningOff) && (
          <form onSubmit={submit} className="space-y-3">
            {setup && (
              <div className="flex flex-col items-center gap-2">
                <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" className="h-40 w-40 rounded-lg border border-border bg-white p-1" />
                <code className="text-xs break-all rounded bg-muted px-2 py-1 select-all">{setup.secret}</code>
              </div>
            )}
            <LabelledInput label="6-digit code from your app" inputMode="numeric" maxLength={6} required value={code} onChange={(event) => setCode(codeOnly(event.target.value))} />
            <div className="flex gap-2">
              <Button type="submit" variant={setup ? 'default' : 'destructive'} disabled={verify.isPending || disable.isPending}>
                {setup ? 'Verify and Turn On' : 'Turn Off'}
              </Button>
              <Button type="button" variant="outline" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

const deviceName = (userAgent) => {
  const text = userAgent || '';
  const browser = ['Edg', 'Chrome', 'Firefox', 'Safari'].find((name) => text.includes(name));
  const system = ['Windows', 'Android', 'iPhone', 'Mac OS', 'Linux'].find((name) => text.includes(name));
  if (!browser && !system) return 'Unknown device';
  return [browser === 'Edg' ? 'Edge' : browser, system].filter(Boolean).join(' on ');
};

export const SessionsCard = () => {
  const { notify } = useNotification();
  const { data: sessions = [], isLoading, error } = useMySessions();
  const revokeOne = useRevokeMySession();
  const revokeOthers = useRevokeMyOtherSessions();
  const hasOthers = sessions.some((session) => !session.isCurrent);
  const onError = (failure) => notify(apiErrorMessage(failure, 'Could not sign out that device.'), 'error');

  return (
    <Card className="border-border bg-card lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Laptop className="h-4 w-4 text-primary" />
          My Devices
        </CardTitle>
        {hasOthers && (
          <Button type="button" variant="outline" size="sm" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate(undefined, { onSuccess: () => notify('Other devices were signed out.', 'success'), onError })}>
            Sign Out Other Devices
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load your devices.')}</p>}
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {deviceName(session.userAgent)}
                {session.isCurrent && <span className="ml-2 text-xs font-semibold text-green-600">This device</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.ipAddress || 'Unknown address'} · Last used {new Date(session.lastUsedAt).toLocaleString()}
              </p>
            </div>
            {!session.isCurrent && (
              <Button type="button" variant="ghost" size="sm" disabled={revokeOne.isPending} onClick={() => revokeOne.mutate(session.id, { onError })}>
                Sign Out
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
