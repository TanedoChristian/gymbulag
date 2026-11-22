import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { format, formatDistanceToNow, subYears } from 'date-fns';
import { AlertCircle, Calculator, CheckCircle2, Database, Download, FileSpreadsheet, HardDrive, KeyRound, Loader2, LogOut, Minus, Plus, RefreshCw, Trash2, Upload, UserRound } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLatestBodyWeight, useSettings } from '../hooks/data';
import { exportAll, importBackup, saveSettings, wipeAllData } from '../lib/repo';
import { buildBackup, downloadFile, parseBackup, toCSV, type Backup } from '../lib/backup';
import { kgToUnit, trimNumber, unitToKg } from '../lib/units';
import { todayKey } from '../lib/date';
import { Modal, NumberField, PageHeader, Segmented, Toggle } from '../components/ui';
import { useToast } from '../context/Toast';
import { useConfirm } from '../context/Confirm';
import { fetchMe, getSyncStatus, runSync, subscribeSync, type ServerInfo } from '../lib/sync';
import { ageFromBirthDate, changePassword, logOut, updateProfile, useAuth } from '../lib/auth';
import { TdeeCalculator } from '../components/TdeeCalculator';
import { fmtKcal } from '../lib/food';

function Row({ title, desc, children, stack }: { title: string; desc?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? 'space-y-2.5 px-4 py-3.5' : 'flex items-center gap-4 px-4 py-3.5'}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{desc}</div>}
      </div>
      <div className={stack ? '' : 'shrink-0'}>{children}</div>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function NutritionGroup() {
  const settings = useSettings();
  const [calc, setCalc] = useState(false);
  const bw = useLatestBodyWeight();
  const field = (key: 'kcalGoal' | 'proteinGoal' | 'carbsGoal' | 'fatGoal', label: string, unit: string, max: number) => (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative">
        <NumberField className="input !pr-10 tabular" integer value={settings[key]} onChange={(v) => saveSettings({ [key]: v && v > 0 ? v : null })} max={max} placeholder="off" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{unit}</span>
      </div>
    </label>
  );
  return (
    <div id="nutrition" className="scroll-mt-20">
      <Group title="Nutrition goals">
        <div className="space-y-3 px-4 py-3.5">
          <button className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-3 text-left ring-1 ring-emerald-500/20" onClick={() => setCalc(true)}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Calculator size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Calculate my calories (TDEE)</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {settings.kcalGoal ? `Current goal ${fmtKcal(settings.kcalGoal)} kcal. Recalculate when your weight or training changes.` : 'From your age, height, weight and activity. Sets the goals below.'}
              </span>
            </span>
          </button>
          <TdeeCalculator open={calc} onClose={() => setCalc(false)} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Daily targets shown on each day and in Progress. Leave a field empty to skip that target.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field('kcalGoal', 'Calories', 'kcal', 10000)}
            {field('proteinGoal', 'Protein', 'g', 1000)}
            {field('carbsGoal', 'Carbs', 'g', 2000)}
            {field('fatGoal', 'Fat', 'g', 1000)}
          </div>
          {bw != null && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-500/[0.06] p-2.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="flex-1">
                For muscle gain, 1.6–2.2 g protein per kg of bodyweight is a common target. At your last logged {trimNumber(bw, 1)} kg that's{' '}
                <b>
                  {Math.round(bw * 1.6)}–{Math.round(bw * 2.2)} g
                </b>
                .
              </span>
              <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => saveSettings({ proteinGoal: Math.round(bw * 2) })}>
                Use {Math.round(bw * 2)} g
              </button>
            </div>
          )}
        </div>
      </Group>
    </div>
  );
}

function AccountGroup() {
  const toast = useToast();
  const confirm = useConfirm();
  const auth = useAuth();
  const status = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [editing, setEditing] = useState<'profile' | 'password' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  // Server summary, refreshed after each sync.
  useEffect(() => {
    fetchMe().then(setInfo).catch(() => {});
  }, [status.lastSync]);

  if (!auth) return null;
  const { user } = auth;
  const age = ageFromBirthDate(user.birthDate);

  const syncNow = async () => {
    const r = await runSync();
    if (r) toast(`Synced · ${r.pushed} up, ${r.pulled} down`, { tone: 'success' });
  };

  const leave = async () => {
    const ok = await confirm({ title: 'Log out?', message: 'Your data stays in your account. It will be removed from this device until you log in again.', confirmLabel: 'Log out' });
    if (!ok) return;
    setLeaving(true);
    if (await logOut()) return;
    setLeaving(false);
    const force = await confirm({
      title: "Couldn't sync",
      message: `${getSyncStatus().error ?? 'The server could not be reached'}. Changes made on this device since the last sync will be lost if you log out now.`,
      confirmLabel: 'Log out anyway',
      danger: true,
    });
    if (force) await logOut({ force: true });
  };

  const line =
    status.state === 'syncing' ? (
      <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Syncing…</span>
    ) : status.state === 'error' ? (
      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertCircle size={12} /> {status.error}</span>
    ) : status.lastSync ? (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={12} /> Synced {formatDistanceToNow(status.lastSync, { addSuffix: true })}</span>
    ) : (
      'Waiting for first sync…'
    );

  return (
    <Group title="Account">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-extrabold text-white">{(user.name || user.email).charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{user.name}</div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {user.email}
            {age != null && ` · ${age} years old`}
          </div>
        </div>
        <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => setEditing('profile')}>
          <UserRound size={13} /> Edit
        </button>
      </div>
      <Row title="Sync" desc={line}>
        <button className="btn-secondary !py-2" onClick={() => void syncNow()} disabled={status.state === 'syncing'}>
          <RefreshCw size={15} className={status.state === 'syncing' ? 'animate-spin' : ''} /> Sync now
        </button>
      </Row>
      {info && (
        <div className="flex items-start gap-2 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          <Database size={14} className="mt-0.5 shrink-0" />
          <span>
            In your account: {plural(info.counts.sessions, 'session')}, {info.counts.activities} {info.counts.activities === 1 ? 'walk or run' : 'walks/runs'}, {info.counts.foodlog} food {info.counts.foodlog === 1 ? 'entry' : 'entries'}, {plural(info.counts.photos, 'photo')}.
          </span>
        </div>
      )}
      <Row title="Password">
        <button className="btn-secondary !py-2" onClick={() => setEditing('password')}>
          <KeyRound size={15} /> Change
        </button>
      </Row>
      <Row title="Log out" desc="Removes your data from this device. It stays in your account.">
        <button className="btn-secondary !py-2" onClick={() => void leave()} disabled={leaving}>
          {leaving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Log out
        </button>
      </Row>
      <Modal open={editing === 'profile'} onClose={() => setEditing(null)} title="Your profile" size="sm">
        {editing === 'profile' && <ProfileForm onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={editing === 'password'} onClose={() => setEditing(null)} title="Change password" size="sm">
        {editing === 'password' && <PasswordForm onDone={() => setEditing(null)} />}
      </Modal>
    </Group>
  );
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const auth = useAuth()!;
  const toast = useToast();
  const [name, setName] = useState(auth.user.name);
  const [birthDate, setBirthDate] = useState(auth.user.birthDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const age = ageFromBirthDate(birthDate);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name, birthDate });
      toast('Profile saved', { tone: 'success' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setBusy(false);
    }
  };
  return (
    <form className="space-y-3" onSubmit={save}>
      <label className="block">
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </label>
      <label className="block">
        <span className="label">Date of birth</span>
        <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required max={format(subYears(new Date(), 13), 'yyyy-MM-dd')} />
        {age != null && <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-400">You're {age}.</span>}
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input className="input" value={auth.user.email} readOnly disabled />
        <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Your email is your login and can't be changed here.</span>
      </label>
      {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Save
      </button>
    </form>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await changePassword(current, next);
      toast(r.otherDevicesLoggedOut ? `Password changed. ${plural(r.otherDevicesLoggedOut, 'other device')} logged out.` : 'Password changed', { tone: 'success' });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
      setBusy(false);
    }
  };
  return (
    <form className="space-y-3" onSubmit={save}>
      <label className="block">
        <span className="label">Current password</span>
        <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label className="block">
        <span className="label">New password</span>
        <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
        <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-400">At least 8 characters. Your other devices will need to log in again.</span>
      </label>
      {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Change password
      </button>
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h2>
      <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const counts = useLiveQuery(async () => ({ sessions: await db.sessions.count(), templates: await db.templates.count(), photos: await db.photos.count(), activities: await db.activities.count(), foodlog: await db.foodlog.count(), weights: await db.weights.count() }), []);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const exportJSON = async () => {
    const data = await exportAll();
    downloadFile(`gymbulag-backup-${todayKey()}.json`, JSON.stringify(buildBackup(data), null, 2), 'application/json');
    toast('Backup downloaded', { tone: 'success' });
  };

  const exportCSV = async () => {
    const data = await exportAll();
    downloadFile(`gymbulag-sets-${todayKey()}.csv`, toCSV(data.sessions, data.exercises, settings.unit), 'text/csv');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) return toast('File is too large to be a backup.', { tone: 'error' });
    const res = parseBackup(await f.text());
    if (!res.ok) return toast(res.error, { tone: 'error', duration: 6000 });
    setPending(res.backup);
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace all data?',
        message: 'Everything currently on this device will be deleted and replaced with the backup. Consider downloading a backup first.',
        confirmLabel: 'Replace',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const r = await importBackup(pending, mode);
      toast(`Imported ${r.sessions} sessions`, { tone: 'success' });
    } catch (e) {
      console.error(e);
      toast('Import failed — your existing data was not changed.', { tone: 'error' });
    }
    setPending(null);
  };

  const wipe = async () => {
    const ok = await confirm({
      title: 'Delete all data?',
      message: `This permanently deletes ${counts?.sessions ?? 0} sessions, ${counts?.templates ?? 0} templates, ${counts?.activities ?? 0} walks/runs, ${counts?.foodlog ?? 0} food entries, ${counts?.weights ?? 0} weigh-ins, ${counts?.photos ?? 0} photos and your custom exercises from this device and from your account, on every device.`,
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    await wipeAllData({ everywhere: true });
    toast('All data deleted');
  };

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.();
    setPersisted(!!ok);
    toast(ok ? 'Storage is now persistent' : 'The browser declined — install the app to improve this', { tone: ok ? 'success' : 'default' });
  };

  const barDisplay = Number(trimNumber(kgToUnit(settings.barWeight, settings.unit), 1));

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        <AccountGroup />

        <Group title="Logging">
          <Row title="How you log" desc={settings.logMode === 'quick' ? 'Quick log: type weight and reps after your workout. No checkboxes or timers.' : 'Live: tick sets as you go, with workout clock and rest timer.'}>
            <Segmented ariaLabel="Logging mode" size="sm" value={settings.logMode} onChange={(logMode) => saveSettings({ logMode })} options={[{ value: 'quick', label: 'Quick' }, { value: 'live', label: 'Live' }]} />
          </Row>
          <Row title="Sets for a new exercise" desc="Exercises you've done before use last time's set count.">
            <div className="flex items-center gap-1">
              <button className="icon-btn" onClick={() => saveSettings({ defaultSets: Math.max(1, settings.defaultSets - 1) })} disabled={settings.defaultSets <= 1} aria-label="Fewer default sets">
                <Minus size={16} />
              </button>
              <span className="w-6 text-center text-base font-extrabold tabular">{settings.defaultSets}</span>
              <button className="icon-btn" onClick={() => saveSettings({ defaultSets: Math.min(10, settings.defaultSets + 1) })} disabled={settings.defaultSets >= 10} aria-label="More default sets">
                <Plus size={16} />
              </button>
            </div>
          </Row>
        </Group>

        <Group title="Training">
          <Row title="Weight unit" desc="Existing logs are converted automatically.">
            <Segmented ariaLabel="Weight unit" size="sm" value={settings.unit} onChange={(unit) => saveSettings({ unit })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          </Row>
          <Row title="Week starts on">
            <Segmented ariaLabel="Week start" size="sm" value={settings.weekStartsOn} onChange={(weekStartsOn) => saveSettings({ weekStartsOn })} options={[{ value: 1, label: 'Mon' }, { value: 0, label: 'Sun' }]} />
          </Row>
          <Row title="Show RPE column" desc="Rate of perceived exertion, 1–10.">
            <Toggle checked={settings.showRpe} onChange={(showRpe) => saveSettings({ showRpe })} label="Show RPE column" />
          </Row>
          <Row title="Bar weight" desc="Used by the plate calculator.">
            <div className="relative w-24">
              <NumberField className="input !py-2 !pr-8 text-right" value={barDisplay} onChange={(v) => v != null && saveSettings({ barWeight: unitToKg(v, settings.unit) })} max={100} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{settings.unit}</span>
            </div>
          </Row>
        </Group>

        <Group title={`Rest timer${settings.logMode === 'quick' ? ' (live mode)' : ''}`}>
          <Row title="Auto-start after a set" desc="Starts when you tick a set as done.">
            <Toggle checked={settings.autoRestTimer} onChange={(autoRestTimer) => saveSettings({ autoRestTimer })} label="Auto-start rest timer" />
          </Row>
          <Row title="Rest duration" stack>
            <div className="flex flex-wrap gap-1.5">
              {[60, 90, 120, 180, 240].map((s) => (
                <button key={s} className={settings.restSeconds === s ? 'chip-on' : 'chip-off'} onClick={() => saveSettings({ restSeconds: s })}>
                  {s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`}
                </button>
              ))}
            </div>
          </Row>
        </Group>

        <NutritionGroup />

        <Group title="Appearance">
          <Row title="Theme">
            <Segmented ariaLabel="Theme" size="sm" value={settings.theme} onChange={(theme) => saveSettings({ theme })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </Row>
        </Group>


        <Group title="Your data">
          <div className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400">
            Everything is kept on this device and synced to your account ({counts?.sessions ?? '…'} sessions, {counts?.templates ?? '…'} templates, {counts?.activities ?? '…'} walks/runs, {counts?.foodlog ?? '…'} food entries, {counts?.weights ?? '…'} weigh-ins, {counts?.photos ?? '…'} photos). Download a backup regularly, or to move to another phone. Backups include your photos.
          </div>
          <Row title="Download backup" desc="Full JSON backup you can restore later.">
            <button className="btn-secondary !py-2" onClick={exportJSON}>
              <Download size={15} /> Backup
            </button>
          </Row>
          <Row title="Restore from backup" desc="Merge with or replace current data.">
            <button className="btn-secondary !py-2" onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> Restore
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </Row>
          <Row title="Export as CSV" desc="Every set, for spreadsheets.">
            <button className="btn-secondary !py-2" onClick={exportCSV}>
              <FileSpreadsheet size={15} /> CSV
            </button>
          </Row>
          {persisted === false && (
            <Row title="Protect storage" desc="Ask the browser not to clear your data when space runs low.">
              <button className="btn-secondary !py-2" onClick={requestPersist}>
                <HardDrive size={15} /> Protect
              </button>
            </Row>
          )}
          <Row title="Delete all data" desc="From this device and your account. Cannot be undone.">
            <button className="btn-ghost !py-2 text-red-600 dark:text-red-400" onClick={wipe}>
              <Trash2 size={15} /> Delete
            </button>
          </Row>
        </Group>

        <p className="pb-4 text-center text-xs text-zinc-400">Gymbulag v{__APP_VERSION__} · Works offline</p>
      </div>

      <Modal open={!!pending} onClose={() => setPending(null)} title="Restore backup" size="sm">
        {pending && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Backup from <b>{new Date(pending.exportedAt).toLocaleString()}</b> with <b>{pending.sessions.length}</b> sessions, <b>{pending.templates.length}</b> templates, <b>{pending.activities.length}</b> walks/runs, <b>{pending.foodlog.length}</b> food entries, <b>{pending.weights.length}</b> weigh-ins and <b>{pending.photos.length}</b> photos.
            </p>
            <div className="mt-5 space-y-2">
              <button className="btn-primary w-full" onClick={() => doImport('merge')}>
                Merge with current data
              </button>
              <button className="btn-secondary w-full !text-red-600 dark:!text-red-400" onClick={() => doImport('replace')}>
                Replace everything
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Merge keeps the most recently edited version of each session.</p>
          </>
        )}
      </Modal>
    </>
  );
}
