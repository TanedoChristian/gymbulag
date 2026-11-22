import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { format, subYears } from 'date-fns';
import { AlertCircle, ChevronDown, Eye, EyeOff, Loader2, Server, UploadCloud } from 'lucide-react';
import { ApiError, api, apiBase, getAuth, getServerUrl, setServerUrl } from '../lib/api';
import { ageFromBirthDate, completeLogin, deviceDataPlan, logIn, logOut, signUp, type AuthResult, type LocalSummary } from '../lib/auth';
import { useConfirm } from '../context/Confirm';

type Mode = 'login' | 'signup';
type Health = { state: 'checking' } | { state: 'ok'; signupCode: boolean } | { state: 'down'; error: string };

const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong');

/** Shown instead of the app until someone is logged in. */
export default function AuthPage() {
  const expired = getAuth()?.expired ? getAuth() : null;
  const [mode, setMode] = useState<Mode>('login');
  const [health, setHealth] = useState<Health>({ state: 'checking' });
  const [server, setServer] = useState(getServerUrl);
  const [showServer, setShowServer] = useState(false);
  const [pending, setPending] = useState<{ res: AuthResult; summary: LocalSummary } | null>(null);

  const check = async (url = server) => {
    setHealth({ state: 'checking' });
    try {
      const h = await api<{ app?: string; accounts?: boolean; signupCode?: boolean }>('/health', undefined, { token: null, base: apiBase(url) });
      if (!h.accounts) throw new Error('This Gymbulag server is out of date. Restart it to enable accounts.');
      setHealth({ state: 'ok', signupCode: !!h.signupCode });
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
    const { plan, summary } = await deviceDataPlan(res.user);
    if (plan === 'ask') setPending({ res, summary });
    else await completeLogin(res, plan === 'resume');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl shadow-lg shadow-indigo-500/30" />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Gymbulag</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {pending ? 'One more thing' : expired ? 'Your login expired. Log in again to keep syncing.' : mode === 'login' ? 'Log in to see your workouts and food on every device.' : 'Create your account.'}
        </p>
      </div>

      {pending ? (
        <DeviceDataStep summary={pending.summary} onChoose={(keep) => completeLogin(pending.res, keep)} onCancel={() => setPending(null)} />
      ) : (
        <>
          {!expired && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-900/[0.05] p-1 dark:bg-white/[0.06]" role="tablist">
              {(['login', 'signup'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={`rounded-xl py-2 text-sm font-bold transition ${mode === m ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400'}`} onClick={() => setMode(m)}>
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
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
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
