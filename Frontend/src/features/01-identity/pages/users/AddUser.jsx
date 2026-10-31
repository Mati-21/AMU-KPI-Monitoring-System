import { useState } from 'react';
import { Lock, Mail, User } from 'lucide-react';

import Button from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { useCan } from '../../../03-access-control/hooks/useCan';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useCreatePerson } from '../../hooks/useUsers';

const MIN_PASSWORD_LENGTH = 8;
const EMPTY_FORM = { firstName: '', middleName: '', lastName: '', staffNumber: '', email: '', phone: '', createLogin: true, username: '', temporaryPassword: '', mfaEnforced: false };

const Field = ({ label, required, children }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium text-foreground">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </span>
    {children}
  </label>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
    <Icon className="h-4 w-4 text-primary" />
    {children}
  </div>
);

/**
 * Creates the person and their login. Offices and roles are given from the office and role pages.
 */
const AddUser = ({ onDone }) => {
  const { notify } = useNotification();
  const can = useCan();
  const create = useCreatePerson();
  const [form, setForm] = useState(EMPTY_FORM);
  const [problem, setProblem] = useState('');
  const canCreateLogin = can('user:create');
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });

  const submit = (event) => {
    event.preventDefault();
    if (form.createLogin && form.temporaryPassword.length < MIN_PASSWORD_LENGTH) {
      setProblem(`The temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setProblem('');
    const { createLogin, username, temporaryPassword, mfaEnforced, ...person } = form;
    create.mutate(
      { ...person, ...(createLogin && { account: { username, temporaryPassword, mfaEnforced } }) },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          notify('User created. Give them an office and role next.', 'success');
          onDone();
        },
        onError: (error) => setProblem(apiErrorMessage(error, 'Could not create this user.')),
      }
    );
  };

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-8 rounded-lg border border-border bg-card p-6">
      <section>
        <SectionTitle icon={User}>Personal Details</SectionTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Field label="First Name" required>
            <Input required value={form.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Middle Name">
            <Input value={form.middleName} onChange={set('middleName')} />
          </Field>
          <Field label="Last Name" required>
            <Input required value={form.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="Staff Number">
            <Input value={form.staffNumber} onChange={set('staffNumber')} />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle icon={Mail}>Contact</SectionTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
      </section>

      {canCreateLogin && (
        <section>
          <SectionTitle icon={Lock}>Login</SectionTitle>
          <label className="mb-4 flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.createLogin} onChange={set('createLogin')} />
            Create a login for this person
          </label>
          {form.createLogin && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Username" required>
                <Input required autoComplete="off" value={form.username} onChange={set('username')} />
              </Field>
              <Field label="Temporary Password" required>
                <Input required type="password" autoComplete="new-password" value={form.temporaryPassword} onChange={set('temporaryPassword')} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
                <input type="checkbox" checked={form.mfaEnforced} onChange={set('mfaEnforced')} />
                Require two-factor authentication
              </label>
              <p className="text-xs text-muted-foreground md:col-span-2">They must choose their own password the first time they sign in.</p>
            </div>
          )}
        </section>
      )}

      {problem && <p className="text-sm text-red-500">{problem}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating...' : 'Create User'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default AddUser;
