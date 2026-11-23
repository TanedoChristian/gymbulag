import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subYears } from 'date-fns';
import { AlertCircle, ChevronDown, Eye, EyeOff, Loader2, Server, UploadCloud } from 'lucide-react';
import { ApiError, api, apiBase, getAuth, getServerUrl, setServerUrl } from '../lib/api';
import { ageFromBirthDate, completeLogin, deviceDataPlan, logIn, logOut, signUp, type AuthResult, type LocalSummary } from '../lib/auth';
import { useConfirm } from '../context/Confirm';
import { consumeOAuthReturn, oauthLogin, startOAuth, type OAuthProviders, type OAuthReturn, type Provider } from '../lib/oauth';

type Mode = 'login' | 'signup';
type Health = { state: 'checking' } | { state: 'ok'; signupCode: boolean; oauth: OAuthProviders } | { state: 'down'; error: string };
/** Coming back from Google / Facebook: checking it, or asking for what a new account needs. */
type OAuthStep = { ret: OAuthReturn; state: 'checking' } | { ret: OAuthReturn; state: 'profile'; email: string; name: string };

const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong');

/** Shown instead of the app until someone is logged in. */
export default function AuthPage() {
  const expired = getAuth()?.expired ? getAuth() : null;
  const [mode, setMode] = useState<Mode>('login');
  const [health, setHealth] = useState<Health>({ state: 'checking' });
  const [server, setServer] = useState(getServerUrl);
  const [showServer, setShowServer] = useState(false);
  const [pending, setPending] = useState<{ res: AuthResult; summary: LocalSummary } | null>(null);
  const navigate = useNavigate();
  const [oauth, setOAuth] = useState<OAuthStep | null>(null);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  const check = async (url = server) => {
    setHealth({ state: 'checking' });
    try {
      const h = await api<{ app?: string; accounts?: boolean; signupCode?: boolean; oauth?: OAuthProviders }>('/health', undefined, { token: null, base: apiBase(url) });
      if (!h.accounts) throw new Error('This Gymbulag server is out of date. Restart it to enable accounts.');
      setHealth({ state: 'ok', signupCode: !!h.signupCode, oauth: h.oauth ?? {} });
    } catch (e) {
      setHealth({ state: 'down', error: errText(e) });
      setShowServer(true);
    }
  };
  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAuthed = async (res: AuthResult) => {
    // Re-logging in after expiry keeps this device's unsynced data, so it must be the same account.
    if (expired && res.user.id !== expired.user.id) {
      await api('/auth/logout', {}, { token: res.token }).catch(() => {});
      throw new Error(`That's a different account. Log in as ${expired.user.email}, or use a different account below.`);
    }
    const { plan, summary } = await deviceDataPlan(res.user);
    if (plan === 'ask') setPending({ res, summary });
    else await completeLogin(res, plan === 'resume');
  };

  // Back from Google / Facebook: finish signing in.
  useEffect(() => {
    const ret = consumeOAuthReturn();
    if (!ret) return;
    navigate(ret.returnTo, { replace: true });
    if (ret.error) return setOAuthError(ret.error);
    setOAuth({ ret, state: 'checking' });
    oauthLogin(ret)
      .then(async (r) => {
        if ('needsProfile' in r) setOAuth({ ret, state: 'profile', email: r.email, name: r.name });
        else await onAuthed(r);
      })
      .catch((e) => {
        setOAuth(null);
        setOAuthError(errText(e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oauthIds = health.state === 'ok' ? health.oauth : {};

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <img src="/icon.svg" alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 font-display text-4xl font-bold tracking-wide">Gymbulag</h1>
        <p className="mt-2 text-sm text-steel-mute dark:text-floor-mute">
          {pending || oauth?.state === 'profile' ? 'One more thing' : expired ? 'Your login expired. Log in again to keep syncing.' : mode === 'login' ? 'Log in to see your workouts and food on every device.' : 'Create your account.'}
        </p>
      </div>

      {pending ? (
        <DeviceDataStep summary={pending.summary} onChoose={(keep) => completeLogin(pending.res, keep)} onCancel={() => setPending(null)} />
      ) : oauth?.state === 'checking' ? (
        <div className="card flex items-center justify-center gap-2 p-6 text-sm text-steel-mute dark:text-floor-mute">
          <Loader2 size={16} className="animate-spin" /> Signing you in…
        </div>
      ) : oauth?.state === 'profile' ? (
        <div className="card p-4">
          <OAuthProfileForm
            step={oauth}
            needsCode={health.state === 'ok' && health.signupCode}
            onAuthed={onAuthed}
            onCancel={() => setOAuth(null)}
          />
        </div>
      ) : (
        <>
          {!expired && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-steel/[0.06] p-1 dark:bg-white/[0.06]" role="tablist">
              {(['login', 'signup'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={`rounded-sm py-2 font-display text-sm font-semibold uppercase tracking-wide transition ${mode === m ? 'bg-rack text-volt-500 shadow-sm dark:bg-volt-500 dark:text-volt-ink' : 'text-steel-mute dark:text-floor-mute'}`} onClick={() => setMode(m)}>
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}
          <div className="card p-4">
            {health.state === 'down' && (
              <div className="mb-3 flex gap-2 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{health.error}. Start it with <code className="font-mono">npm run server</code>, or check the server address below.</span>
              </div>
            )}
            {oauthError && <div className="mb-3"><ErrorLine error={oauthError} /></div>}
            <OAuthButtons ids={oauthIds} />
            {mode === 'login' ? <LoginForm key={expired?.user.email ?? ''} defaultEmail={expired?.user.email} onAuthed={onAuthed} /> : <SignupForm needsCode={health.state === 'ok' && health.signupCode} onAuthed={onAuthed} />}
          </div>
          {expired && <SwitchAccount />}

          <div className="mt-4">
            <button className="mx-auto flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400" onClick={() => setShowServer((v) => !v)} aria-expanded={showServer}>
              <Server size={12} /> Server {health.state === 'ok' ? '· connected' : health.state === 'checking' ? '· checking…' : '· not reachable'}
              <ChevronDown size={12} className={showServer ? 'rotate-180' : ''} />
            </button>
            {showServer && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setServerUrl(server);
                  void check(server);
                }}
              >
                <input className="input" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Same address as the app" value={server} onChange={(e) => setServer(e.target.value)} aria-label="Server address" />
                <button className="btn-secondary shrink-0 !py-2">Check</button>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            <a className="underline" href="/privacy">Privacy policy</a> · <a className="underline" href="/data-deletion">Delete your data</a>
          </p>
        </>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="label">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input !pr-10" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} required minLength={autoComplete === 'new-password' ? 8 : undefined} />
      <button type="button" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
      <AlertCircle size={13} className="mt-px shrink-0" /> {error}
    </p>
  );
}

function useSubmit(fn: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function LoginForm({ defaultEmail, onAuthed }: { defaultEmail?: string; onAuthed: (r: AuthResult) => Promise<void> }) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => onAuthed(await logIn(email, password)));
  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={!!defaultEmail} />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <ErrorLine error={error} />
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Log in
      </button>
    </form>
  );
}

function SignupForm({ needsCode, onAuthed }: { needsCode: boolean; onAuthed: (r: AuthResult) => Promise<void> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [code, setCode] = useState('');
  const age = birthDate ? ageFromBirthDate(birthDate) : null;
  const { busy, error, submit } = useSubmit(async () => onAuthed(await signUp({ name, email, password, birthDate, signupCode: code || undefined })));
  return (
    <form className="space-y-3" onSubmit={submit}>
      <Field label="Name">
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </Field>
      <Field label="Email" hint="One account per email.">
        <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label="Date of birth" hint={age != null && age >= 0 ? `You're ${age}. Used for your calorie needs, which change with age.` : 'Used for your calorie needs, which change with age.'}>
        <input className="input" type="date" autoComplete="bday" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required min="1900-01-01" max={format(subYears(new Date(), 13), 'yyyy-MM-dd')} />
      </Field>
      {needsCode && (
        <Field label="Sign-up code" hint="Ask whoever runs this server.">
          <input className="input" autoComplete="off" autoCapitalize="off" value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
      )}
      <ErrorLine error={error} />
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Create account
      </button>
    </form>
  );
}

const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', facebook: 'Facebook' };

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
      <path fill="#fff" d="M16.7 15.5l.5-3.5h-3.4V9.7c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.8 0-4.5 1.7-4.5 4.7V12h-3v3.5h3v8.4a12 12 0 0 0 3.7 0v-8.4h2.9z" />
    </svg>
  );
}

/** "Continue with Google / Facebook", for the providers the server has keys for. */
function OAuthButtons({ ids }: { ids: OAuthProviders }) {
  const providers = (['google', 'facebook'] as const).filter((p) => ids[p]);
  if (!providers.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {providers.map((p) => (
        <button key={p} type="button" className="btn-secondary w-full" onClick={() => startOAuth(p, ids[p]!)}>
          {p === 'google' ? <GoogleLogo /> : <FacebookLogo />} Continue with {PROVIDER_LABEL[p]}
        </button>
      ))}
      <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" /> or with email <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

/** New account from Google / Facebook: the provider gave us the email and name; we still need the age. */
function OAuthProfileForm({ step, needsCode, onAuthed, onCancel }: { step: { ret: OAuthReturn; email: string; name: string }; needsCode: boolean; onAuthed: (r: AuthResult) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(step.name);
  const [birthDate, setBirthDate] = useState('');
  const [code, setCode] = useState('');
  const age = birthDate ? ageFromBirthDate(birthDate) : null;
  const { busy, error, submit } = useSubmit(async () => {
    const r = await oauthLogin(step.ret, { name, birthDate, signupCode: code || undefined });
    if ('needsProfile' in r) throw new Error('Something went wrong. Try again.');
    await onAuthed(r);
  });
  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-sm text-steel-mute dark:text-floor-mute">
        Creating an account for <span className="font-semibold text-current">{step.email}</span> with {PROVIDER_LABEL[step.ret.provider]}.
      </p>
      <Field label="Name">
        <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </Field>
      <Field label="Date of birth" hint={age != null && age >= 0 ? `You're ${age}. Used for your calorie needs, which change with age.` : 'Used for your calorie needs, which change with age.'}>
        <input className="input" type="date" autoComplete="bday" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required min="1900-01-01" max={format(subYears(new Date(), 13), 'yyyy-MM-dd')} />
      </Field>
      {needsCode && (
        <Field label="Sign-up code" hint="Ask whoever runs this server.">
          <input className="input" autoComplete="off" autoCapitalize="off" value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
      )}
      <ErrorLine error={error} />
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Create account
      </button>
      <button type="button" className="btn-ghost w-full text-xs" disabled={busy} onClick={onCancel}>
        Back
      </button>
    </form>
  );
}

/** First login on a device that already has workouts logged without an account. */
function DeviceDataStep({ summary, onChoose, onCancel }: { summary: LocalSummary; onChoose: (keep: boolean) => Promise<void>; onCancel: () => void }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const parts = [
    summary.sessions && `${summary.sessions} workout${summary.sessions === 1 ? '' : 's'}`,
    summary.activities && `${summary.activities} ${summary.activities === 1 ? 'walk or run' : 'walks/runs'}`,
    summary.foodlog && `${summary.foodlog} food entr${summary.foodlog === 1 ? 'y' : 'ies'}`,
    summary.photos && `${summary.photos} photo${summary.photos === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const choose = async (keep: boolean) => {
    if (!keep) {
      const ok = await confirm({ title: 'Delete it from this device?', message: 'What you logged on this device without an account will be deleted. Your account keeps its own data.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
    }
    setBusy(true);
    await onChoose(keep);
  };
  return (
    <div className="card space-y-3 p-4">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-volt-500/15 link-accent">
          <UploadCloud size={20} />
        </span>
        <div className="text-sm">
          <div className="font-bold">This device has data that isn't in an account</div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">{parts.length ? parts.join(', ') : 'Your logged data'}. Add it to your account so it shows on all your devices?</div>
        </div>
      </div>
      <button className="btn-primary w-full" disabled={busy} onClick={() => void choose(true)}>
        {busy && <Loader2 size={16} className="animate-spin" />} Add it to my account
      </button>
      <button className="btn-secondary w-full" disabled={busy} onClick={() => void choose(false)}>
        Start fresh
      </button>
      <button className="btn-ghost w-full text-xs" disabled={busy} onClick={onCancel}>
        Back
      </button>
    </div>
  );
}

function SwitchAccount() {
  const confirm = useConfirm();
  const go = async () => {
    const ok = await confirm({
      title: 'Use a different account?',
      message: "This device's data will be cleared. Anything changed since the last sync won't reach the server.",
      confirmLabel: 'Clear and switch',
      danger: true,
    });
    if (ok) await logOut({ force: true });
  };
  return (
    <button className="btn-ghost mx-auto mt-3 flex text-xs" onClick={() => void go()}>
      Log in with a different account
    </button>
  );
}
