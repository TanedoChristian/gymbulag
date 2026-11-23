import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Ban, CircleOff, KeyRound, Loader2, LogOut, MonitorSmartphone, MoreHorizontal, Save, ShieldMinus, ShieldPlus, UserCheck } from 'lucide-react';
import { TabBar } from '../../components/ui';
import { Menu } from '../../components/Menu';
import { useToast } from '../../context/Toast';
import { describeDevice, getUser, REASON_LABEL, setUserAvatar, signOutUser, updateUser, type AdminUser, type UserDetail } from '../../lib/admin';
import { Avatar, Badge, Drawer, ErrorBlock, Field, LoadingBlock } from './kit';
import { AvatarPicker } from '../../components/AvatarPicker';
import { BIO_MAX, EXPERIENCE_OPTIONS, GENDER_OPTIONS, GOAL_OPTIONS, labelOf, type Experience, type FitnessGoal, type Gender } from '../../lib/profile';
import { RoleBadge, StatusBadge, type useUserActions } from './userActions';

type Tab = 'profile' | 'activity' | 'devices' | 'gyms';

/** Everything about one account, with the actions an admin can take. */
export function UserDrawer({
  userId,
  meId,
  actions,
  onClose,
  onChanged,
  reloadKey,
}: {
  userId: number | null;
  meId: number | undefined;
  actions: ReturnType<typeof useUserActions>;
  onClose: () => void;
  onChanged: (u: AdminUser) => void;
  reloadKey: number;
}) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');

  const load = useCallback(() => {
    if (!userId) return;
    setError(null);
    getUser(userId)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [userId]);

  useEffect(() => {
    setData(null);
    setTab('profile');
  }, [userId]);
  useEffect(load, [load, reloadKey]);

  const u = data?.user;
  const self = u?.id === meId;

  return (
    <Drawer open={!!userId} onClose={onClose} label="User details">
      {error ? (
        <div className="p-5 pt-14">
          <ErrorBlock message={error} onRetry={load} />
        </div>
      ) : !data || !u ? (
        <LoadingBlock />
      ) : (
        <>
          <header className="border-b border-steel/10 px-5 pb-4 pt-5 dark:border-white/[0.06]">
            <div className="flex items-start gap-4 pr-10">
              <Avatar name={u.name || u.email} avatarKey={u.avatarKey} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-2xl font-bold leading-tight tracking-wide">{u.name || '—'}</h2>
                <p className="truncate text-sm text-steel-mute dark:text-floor-mute">{u.email}</p>
                {u.bio && <p className="mt-1 line-clamp-2 text-xs italic text-steel-mute dark:text-floor-mute">“{u.bio}”</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <RoleBadge user={u} />
                  <StatusBadge status={u.status} />
                  {self && <Badge>You</Badge>}
                </div>
              </div>
            </div>
            {!self && (
              <div className="mt-4 flex flex-wrap gap-2">
                {u.role === 'admin' ? (
                  <button className="btn-secondary !py-2 text-xs" disabled={u.adminSource === 'env'} title={u.adminSource === 'env' ? 'Set in ADMIN_EMAILS on the server' : undefined} onClick={() => actions.role(u, 'user')}>
                    <ShieldMinus size={15} /> Demote
                  </button>
                ) : (
                  <button className="btn-secondary !py-2 text-xs" onClick={() => actions.role(u, 'admin')}>
                    <ShieldPlus size={15} /> Promote to admin
                  </button>
                )}
                {u.status === 'active' ? (
                  <button className="btn-secondary !py-2 text-xs" onClick={() => actions.status(u, 'inactive')}>
                    <CircleOff size={15} /> Deactivate
                  </button>
                ) : (
                  <button className="btn-primary !py-2 text-xs" onClick={() => actions.status(u, 'active')}>
                    <UserCheck size={15} /> {u.status === 'blocked' ? 'Unblock' : 'Reactivate'}
                  </button>
                )}
                {u.status !== 'blocked' && (
                  <button className="btn-danger !py-2 text-xs" onClick={() => actions.status(u, 'blocked')}>
                    <Ban size={15} /> Block
                  </button>
                )}
                <Menu
                  label="More actions"
                  triggerClassName="btn-ghost !py-2 !px-2.5"
                  trigger={<MoreHorizontal size={16} />}
                  items={[
                    { label: 'Reset password', icon: <KeyRound size={16} />, onSelect: () => actions.resetPassword(u) },
                    { label: 'Sign out everywhere', icon: <LogOut size={16} />, disabled: data.devices.length === 0, onSelect: () => actions.signOutAll(u) },
                  ]}
                />
              </div>
            )}
          </header>

          <div className="px-5 pt-3">
            <TabBar<Tab>
              ariaLabel="User sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'profile', label: 'Profile' },
                { value: 'activity', label: `Logins (${data.logins.length})` },
                { value: 'devices', label: `Devices (${data.devices.length})` },
                { value: 'gyms', label: `Gyms (${data.memberships.length + data.owned.length})` },
              ]}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8 pt-3">
            {tab === 'profile' && <ProfileTab data={data} onSaved={(nu) => (setData({ ...data, user: nu }), onChanged(nu))} />}
            {tab === 'activity' && <ActivityTab data={data} />}
            {tab === 'devices' && <DevicesTab data={data} self={self} onChanged={load} />}
            {tab === 'gyms' && <GymsTab data={data} />}
          </div>
        </>
      )}
      {actions.modal}
    </Drawer>
  );
}

function ProfileTab({ data, onSaved }: { data: UserDetail; onSaved: (u: AdminUser) => void }) {
  const toast = useToast();
  const u = data.user;
  const initial = () => ({
    name: u.name,
    email: u.email,
    birthDate: u.birthDate,
    phone: u.phone,
    gender: u.gender as Gender,
    city: u.city,
    fitnessGoal: u.fitnessGoal as FitnessGoal,
    experience: u.experience as Experience,
    bio: u.bio,
  });
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial()), [u]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== initial()[k]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await updateUser(u.id, form));
      toast('Profile saved', { tone: 'success' });
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const select = <T extends string>(label: string, key: 'gender' | 'fitnessGoal' | 'experience', options: { value: T; label: string }[]) => (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={form[key]} onChange={(e) => set(key, e.target.value as never)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <AvatarPicker size="lg" name={u.name || u.email} avatarKey={u.avatarKey} onUpload={async (img) => onSaved(await setUserAvatar(u.id, img))} onRemove={async () => onSaved(await setUserAvatar(u.id, null))} />
      </div>

      <form onSubmit={save} className="card space-y-3 p-4">
        <h3 className="text-sm font-bold">Edit profile</h3>
        <label className="block">
          <span className="label">Name</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={254} required />
          </label>
          <label className="block">
            <span className="label">Phone</span>
            <input className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} />
          </label>
          <label className="block">
            <span className="label">Date of birth</span>
            <input className="input" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} required />
          </label>
          {select('Gender', 'gender', GENDER_OPTIONS)}
          <label className="block">
            <span className="label">City</span>
            <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={100} />
          </label>
          {select('Main goal', 'fitnessGoal', GOAL_OPTIONS)}
          {select('Experience', 'experience', EXPERIENCE_OPTIONS)}
        </div>
        <label className="block">
          <span className="label">Bio</span>
          <textarea className="input min-h-[4rem] resize-y" value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={BIO_MAX} rows={2} />
        </label>
        <div className="flex justify-end gap-2">
          {dirty && (
            <button type="button" className="btn-ghost" onClick={() => setForm(initial())}>
              Cancel
            </button>
          )}
          <button className="btn-primary" disabled={!dirty || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
          </button>
        </div>
      </form>

      <dl className="divide-y divide-steel/10 dark:divide-white/[0.06]">
        <Field label="User ID">#{u.id}</Field>
        <Field label="Phone">{u.phone ? <a className="link-accent" href={`tel:${u.phone}`}>{u.phone}</a> : '—'}</Field>
        <Field label="Gender">{u.gender ? labelOf(GENDER_OPTIONS, u.gender as Gender) : '—'}</Field>
        <Field label="City">{u.city || '—'}</Field>
        <Field label="Goal">{u.fitnessGoal ? labelOf(GOAL_OPTIONS, u.fitnessGoal as FitnessGoal) : '—'}</Field>
        <Field label="Experience">{u.experience ? labelOf(EXPERIENCE_OPTIONS, u.experience as Experience) : '—'}</Field>
        <Field label="Joined">{format(u.createdAt, 'd MMM yyyy, HH:mm')}</Field>
        <Field label="Last active">{u.lastSeen ? formatDistanceToNow(u.lastSeen, { addSuffix: true }) : 'Not signed in'}</Field>
        <Field label="Status changed">{u.statusChangedAt ? format(u.statusChangedAt, 'd MMM yyyy, HH:mm') : '—'}</Field>
        <Field label="Workouts">
          {data.workouts.total.toLocaleString()} logged{data.workouts.last && ` · last on ${format(parseISO(data.workouts.last), 'd MMM yyyy')}`}
        </Field>
        <Field label="Admin access">{u.adminSource === 'env' ? 'Yes, from ADMIN_EMAILS on the server' : u.adminSource === 'role' ? 'Yes, promoted in the admin panel' : 'No'}</Field>
      </dl>
    </div>
  );
}

function ActivityTab({ data }: { data: UserDetail }) {
  if (!data.logins.length) return <p className="py-10 text-center text-sm text-steel-mute">No sign-ins recorded yet.</p>;
  return (
    <ol className="relative space-y-0 border-l border-steel/15 pl-5 dark:border-white/10">
      {data.logins.map((e) => (
        <li key={e.id} className="relative py-2.5">
          <span className={`absolute -left-[26px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-floor dark:ring-floor-dark ${e.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={e.success ? 'green' : 'red'}>{REASON_LABEL[e.reason] ?? e.reason}</Badge>
            <Badge tone={e.portal === 'admin' ? 'volt' : 'gray'}>{e.portal === 'admin' ? 'Admin panel' : 'App'}</Badge>
            <span className="ml-auto text-xs text-steel-mute dark:text-floor-mute" title={format(e.at, 'd MMM yyyy HH:mm:ss')}>
              {formatDistanceToNow(e.at, { addSuffix: true })}
            </span>
          </div>
          <div className="mt-1 text-xs text-steel-mute dark:text-floor-mute">
            {describeDevice(e.userAgent)} · {e.ip || 'unknown IP'}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DevicesTab({ data, self, onChanged }: { data: UserDetail; self: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const revoke = async (id: string) => {
    setBusy(id);
    try {
      await signOutUser(data.user.id, id);
      toast('Device signed out', { tone: 'success' });
      onChanged();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };
  if (!data.devices.length) return <p className="py-10 text-center text-sm text-steel-mute">Not signed in on any device.</p>;
  return (
    <ul className="space-y-2">
      {data.devices.map((d) => (
        <li key={d.id} className="card flex items-center gap-3 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-steel/[0.07] dark:bg-white/[0.06]">
            <MonitorSmartphone size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {describeDevice(d.device)} {d.admin && <Badge tone="volt">Admin panel</Badge>}
            </div>
            <div className="text-xs text-steel-mute dark:text-floor-mute">
              Signed in {format(d.createdAt, 'd MMM yyyy')} · active {formatDistanceToNow(d.lastUsedAt, { addSuffix: true })}
            </div>
          </div>
          {!self && (
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => revoke(d.id)} disabled={busy === d.id}>
              {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Sign out
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function GymsTab({ data }: { data: UserDetail }) {
  if (!data.memberships.length && !data.owned.length) return <p className="py-10 text-center text-sm text-steel-mute">Not in any gym community.</p>;
  return (
    <div className="space-y-5">
      {data.owned.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Gym owner of</h3>
          <ul className="space-y-1.5">
            {data.owned.map((c) => (
              <li key={c.id} className="card flex items-center gap-2 px-3 py-2.5 text-sm">
                <span className="flex-1 font-semibold">{c.name}</span>
                {!c.active && <Badge tone="amber">Deactivated</Badge>}
                <Badge tone="blue">Owner</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.memberships.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Member of</h3>
          <ul className="space-y-1.5">
            {data.memberships.map((m) => (
              <li key={m.id} className="card flex items-center gap-2 px-3 py-2.5 text-sm">
                <span className="flex-1">
                  <span className="font-semibold">{m.name}</span>
                  <span className="block text-xs text-steel-mute dark:text-floor-mute">Joined {format(m.joinedAt, 'd MMM yyyy')}</span>
                </span>
                {!m.active && <Badge tone="amber">Deactivated</Badge>}
                <Badge tone={m.status === 'blocked' ? 'red' : 'green'}>{m.status === 'blocked' ? 'Blocked' : 'Member'}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

