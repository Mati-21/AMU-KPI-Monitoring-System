import { useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

import { api } from '../../../../shared/api/axios';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { Input } from '../../../../shared/components/ui/Input';

const MIN_PASSWORD_LENGTH = 8;
const inputClass = 'pl-10 h-11 w-full text-base';

const IconField = ({ id, label, icon: Icon, ...props }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-xs font-semibold text-foreground/70 ml-1">
      {label}
    </label>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input id={id} className={inputClass} required {...props} />
    </div>
  </div>
);

const ErrorText = ({ error, children }) =>
  error || children ? <p className="text-sm text-red-500">{children || apiErrorMessage(error, 'Login failed. Please try again.')}</p> : null;

const SubmitButton = ({ pending, children, pendingText }) => (
  <button
    type="submit"
    disabled={pending}
    className="w-full h-11 flex items-center justify-center gap-2 text-sm font-medium rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
  >
    {pending ? pendingText : children}
    <ArrowRight className="w-4 h-4" />
  </button>
);

const BackToSignIn = ({ onClick }) => (
  <button type="button" onClick={onClick} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
    Back to sign in
  </button>
);

const StepTitle = ({ title, text }) => (
  <div className="text-center space-y-1">
    <h3 className="text-xl font-bold text-foreground tracking-tight">{title}</h3>
    {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
  </div>
);

export const PasswordStep = ({ mutation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ identifier: identifier.trim(), password });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepTitle title="Sign In" />
      <IconField id="identifier" label="Username or Email" icon={Mail} type="text" autoComplete="username" placeholder="you@amu.edu.et" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
      <IconField id="password" label="Password" icon={Lock} type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
      <ErrorText error={mutation.error} />
      <SubmitButton pending={mutation.isPending} pendingText="Signing In...">
        Sign In
      </SubmitButton>
    </form>
  );
};

export const ChangePasswordStep = ({ mutation, onBack }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setProblem(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setProblem('The passwords do not match.');
    setProblem('');
    return mutation.mutate(password);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepTitle title="Choose a New Password" text="You signed in with a temporary password. Choose your own to continue." />
      <IconField id="new-password" label="New Password" icon={Lock} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <IconField id="confirm-password" label="Confirm Password" icon={Lock} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      <ErrorText error={mutation.error}>{problem}</ErrorText>
      <SubmitButton pending={mutation.isPending} pendingText="Saving...">
        Continue
      </SubmitButton>
      <BackToSignIn onClick={onBack} />
    </form>
  );
};

const CodeField = ({ value, onChange }) => (
  <IconField
    id="code"
    label="6-digit Code"
    icon={KeyRound}
    type="text"
    inputMode="numeric"
    autoComplete="one-time-code"
    maxLength={6}
    placeholder="123456"
    value={value}
    onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
  />
);

export const MfaSetupStep = ({ mutation, onBack }) => {
  const [setup, setSetup] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    api
      .post('/auth/mfa/setup')
      .then(({ data }) => setSetup(data.data))
      .catch(setSetupError);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(code);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <StepTitle title="Set Up Two-Factor Authentication" text="Scan this code with an authenticator app, then enter the code it shows." />
      {setup ? (
        <div className="flex flex-col items-center gap-2">
          <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg border border-border bg-white p-1" />
          <p className="text-xs text-muted-foreground">Or enter this key by hand:</p>
          <code className="text-xs break-all rounded bg-muted px-2 py-1 select-all">{setup.secret}</code>
        </div>
      ) : (
        !setupError && <p className="text-center text-sm text-muted-foreground">Preparing...</p>
      )}
      <CodeField value={code} onChange={setCode} />
      <ErrorText error={mutation.error || setupError} />
      <SubmitButton pending={mutation.isPending} pendingText="Verifying...">
        Verify and Continue
      </SubmitButton>
      <BackToSignIn onClick={onBack} />
    </form>
  );
};

export const MfaCodeStep = ({ mutation, onBack }) => {
  const [code, setCode] = useState('');

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(code);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex justify-center">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>
      <StepTitle title="Two-Factor Authentication" text="Enter the code from your authenticator app." />
      <CodeField value={code} onChange={setCode} />
      <ErrorText error={mutation.error} />
      <SubmitButton pending={mutation.isPending} pendingText="Verifying...">
        Verify
      </SubmitButton>
      <BackToSignIn onClick={onBack} />
    </form>
  );
};
