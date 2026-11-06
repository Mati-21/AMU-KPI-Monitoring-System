import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react';

import { api } from '../../../../shared/api/axios';
import { apiErrorMessage } from '../../../../shared/lib/apiError';

const MIN_PASSWORD_LENGTH = 8;
const CODE_LENGTH = 6;
const AUTHENTICATOR_APPS = ['Google Authenticator', 'Microsoft Authenticator', 'Authy'];
const PAGE_DOTS = { backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)', backgroundSize: '24px 24px' };
const STRENGTH_LEVELS = [
  { label: 'Too short', bar: 'w-1/6 bg-red-500', text: 'text-red-500' },
  { label: 'Weak', bar: 'w-1/4 bg-red-500', text: 'text-red-500' },
  { label: 'Fair', bar: 'w-1/2 bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'w-3/4 bg-blue-500', text: 'text-blue-600' },
  { label: 'Excellent', bar: 'w-full bg-emerald-500', text: 'text-emerald-600' },
];

const strengthOf = (password) => {
  if (password.length < MIN_PASSWORD_LENGTH) return STRENGTH_LEVELS[0];
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((kind) => kind.test(password)).length;
  return STRENGTH_LEVELS[kinds];
};

const ProgressItem = ({ number, title, text, state }) => {
  const isActive = state === 'active';
  const isDone = state === 'done';
  return (
    <li className={`flex items-center gap-3 rounded-xl border p-3 ${isActive ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/60'}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isDone ? 'bg-emerald-600 text-white' : isActive ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'
        }`}
      >
        {isDone ? <Check className="h-4 w-4" /> : number}
      </span>
      <div className="min-w-0">
        <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${state === 'waiting' ? 'text-muted-foreground' : 'text-foreground'}`}>
          {title}
          {isDone && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600">Done</span>}
          {isActive && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Active</span>}
        </p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </li>
  );
};

const SetupLayout = ({ step, stepCount, icon: Icon, heading, title, text, onCancel, onSubmit, children }) => (
  <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-background p-4 sm:p-6" style={PAGE_DOTS}>
    <div className="my-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-floating md:grid-cols-[2fr_3fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-muted/40 p-6 sm:p-8 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-bold text-foreground">{heading}</h1>
            <p className="text-xs text-muted-foreground">Required before you can sign in</p>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Setup progress (step {step} of {stepCount})
          </p>
          <ol className="space-y-3">
            <ProgressItem number={1} title="Permanent Password" text={step === 1 ? 'Replace your temporary password.' : 'Your own password is set.'} state={step === 1 ? 'active' : 'done'} />
            {stepCount === 2 && <ProgressItem number={2} title="Enable 2FA Authenticator" text="Link your phone to secure your account." state={step === 2 ? 'active' : 'waiting'} />}
          </ol>
        </div>

        {step === 2 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticator apps you can use</p>
            <ul className="space-y-2 rounded-xl border border-border bg-card/60 p-3 text-xs text-foreground">
              {AUTHENTICATOR_APPS.map((app) => (
                <li key={app} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {app}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Secure account setup
          </span>
          <button type="button" onClick={onCancel} className="font-medium text-primary hover:underline">
            Cancel
          </button>
        </div>
      </aside>

      <form onSubmit={onSubmit} className="flex flex-col p-6 sm:p-8">
        <div className="border-b border-border pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
        <div className="flex flex-1 flex-col gap-5 py-6">{children}</div>
      </form>
    </div>
  </div>
);

const Banner = ({ children }) => (
  <p role="alert" className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
    <AlertCircle className="h-5 w-5 shrink-0" />
    {children}
  </p>
);

const SubmitButton = ({ disabled, children }) => (
  <button
    type="submit"
    disabled={disabled}
    className="mt-auto flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
  >
    {children}
    <ArrowRight className="h-5 w-5" />
  </button>
);

const PasswordField = ({ id, label, icon: Icon, value, onChange, autoFocus }) => {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-13 w-full rounded-xl border border-input bg-card pl-11 pr-12 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label}` : `Show ${label}`} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <VisibilityIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

const StrengthMeter = ({ password }) => {
  const strength = strengthOf(password);
  return (
    <div className="-mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Security strength:</span>
        <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${strength.bar}`} />
      </div>
    </div>
  );
};

export const ChangePasswordStep = ({ mutation, onCancel, mfaSetupRequired }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState('');
  const hasConfirm = confirm.length > 0;
  const matches = password === confirm;

  const submit = (event) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setProblem(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (!matches) return setProblem('The passwords do not match.');
    setProblem('');
    return mutation.mutate(password);
  };

  return (
    <SetupLayout step={1} stepCount={mfaSetupRequired ? 2 : 1} icon={KeyRound} heading="Account Setup" title="Set Permanent Password" text="Choose a secure permanent password for your account" onCancel={onCancel} onSubmit={submit}>
      <Banner>{problem || (mutation.error ? apiErrorMessage(mutation.error, 'Could not save the password.') : 'You signed in with a temporary password. Change it to continue.')}</Banner>
      <PasswordField id="new-password" label="New permanent password" icon={KeyRound} value={password} onChange={setPassword} autoFocus />
      <StrengthMeter password={password} />
      <div>
        <PasswordField id="confirm-password" label="Confirm new password" icon={Lock} value={confirm} onChange={setConfirm} />
        {hasConfirm && (
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${matches ? 'text-emerald-600' : 'text-red-500'}`}>
            {matches && <Check className="h-3.5 w-3.5" />}
            {matches ? 'Passwords match' : 'Passwords do not match'}
          </p>
        )}
      </div>
      <SubmitButton disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : mfaSetupRequired ? 'Save & Continue to 2FA Setup' : 'Save & Sign In'}</SubmitButton>
    </SetupLayout>
  );
};

const CodeBoxes = ({ value, onChange }) => {
  const boxes = useRef([]);
  const focusBox = (index) => boxes.current[Math.max(0, Math.min(index, CODE_LENGTH - 1))]?.focus();

  // When the code is cleared after a wrong attempt, start again at the first box
  useEffect(() => {
    if (value === '') boxes.current[0]?.focus();
  }, [value]);

  const enter = (index, text) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!digits) return;
    const start = Math.min(index, value.length);
    const next = (value.slice(0, start) + digits + value.slice(start + digits.length)).slice(0, CODE_LENGTH);
    onChange(next);
    focusBox(start + digits.length);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'ArrowLeft') focusBox(index - 1);
    if (event.key === 'ArrowRight') focusBox(index + 1);
    if (event.key !== 'Backspace') return;
    event.preventDefault();
    const target = value[index] ? index : index - 1;
    if (target < 0) return;
    onChange(value.slice(0, target) + value.slice(target + 1));
    focusBox(target);
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(box) => {
            boxes.current[index] = box;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          aria-label={`Digit ${index + 1}`}
          value={value[index] ?? ''}
          onFocus={(event) => event.target.select()}
          onChange={(event) => enter(index, event.target.value)}
          onKeyDown={handleKeyDown(index)}
          className="h-13 w-11 rounded-xl border border-input bg-card text-center text-lg font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-13"
        />
      ))}
    </div>
  );
};

export const MfaSetupStep = ({ mutation, onCancel }) => {
  const [setup, setSetup] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [code, setCode] = useState('');
  const [showKey, setShowKey] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    // Each request replaces the saved secret, so a second one would make the QR code on screen wrong
    if (requested.current) return;
    requested.current = true;
    api
      .post('/auth/mfa/setup')
      .then(({ data }) => setSetup(data.data))
      .catch(setSetupError);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate(code, { onError: () => setCode('') });
  };

  const error = mutation.error || setupError;

  return (
    <SetupLayout step={2} stepCount={2} icon={Smartphone} heading="Two-Factor Authentication" title="Scan QR Code & Activate" text="Open your authenticator app and point your camera at the QR code below" onCancel={onCancel} onSubmit={submit}>
      {error && <Banner>{apiErrorMessage(error, 'Could not set up two-factor authentication.')}</Banner>}

      <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-muted/50 p-4 sm:flex-row">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-card">
          {setup ? <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" className="h-full w-full" /> : !setupError && <p className="text-sm text-gray-500">Preparing...</p>}
        </div>
        <div className="min-w-0 space-y-2">
          <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-primary">Step 1: Scan</span>
          <p className="text-sm font-semibold text-foreground">Add your AMU KPI Monitoring account.</p>
          <p className="text-sm text-muted-foreground">Tap the + button in your app, then point your camera here.</p>
          <button type="button" onClick={() => setShowKey(!showKey)} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <KeyRound className="h-3.5 w-3.5" />
            {showKey ? 'Hide manual setup key' : "Can't scan? View manual setup key"}
          </button>
          {showKey && setup && <code className="block select-all break-all rounded bg-card px-2 py-1 text-xs text-foreground">{setup.secret}</code>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide text-foreground/70">Step 2: Enter 6-digit code</span>
          <span className="text-muted-foreground">From your app</span>
        </div>
        <CodeBoxes value={code} onChange={setCode} />
      </div>

      <SubmitButton disabled={mutation.isPending || !setup || code.length < CODE_LENGTH}>{mutation.isPending ? 'Verifying...' : 'Verify Code & Complete Sign-In'}</SubmitButton>
    </SetupLayout>
  );
};
