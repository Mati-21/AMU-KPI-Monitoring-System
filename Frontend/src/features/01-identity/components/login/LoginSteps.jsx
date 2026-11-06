import { useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { Input } from '../../../../shared/components/ui/Input';

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

const CodeField = ({ value, onChange }) => (
  <IconField
    id="code"
    autoFocus
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

export const MfaCodeStep = ({ mutation, onBack }) => {
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState(0);

  // A wrong code is cleared, and the field is rebuilt so the cursor is back in it
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(code, {
      onError: () => {
        setCode('');
        setAttempt((count) => count + 1);
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex justify-center">
        <ShieldCheck className="h-8 w-8 text-primary" />
      </div>
      <StepTitle title="Two-Factor Authentication" text="Enter the code from your authenticator app." />
      <CodeField key={attempt} value={code} onChange={setCode} />
      <ErrorText error={mutation.error} />
      <SubmitButton pending={mutation.isPending} pendingText="Verifying...">
        Verify
      </SubmitButton>
      <BackToSignIn onClick={onBack} />
    </form>
  );
};
