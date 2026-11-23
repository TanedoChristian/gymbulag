import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Ban, Building2, CircleOff, Loader2, MapPin, MoreVertical, Plus, QrCode, Search, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { EmptyState, Modal, PageHeader, StatTile, TabBar, Toggle } from '../components/ui';
import { Menu } from '../components/Menu';
import { QrModal } from '../components/community/QrModal';
import { MembersPanel } from '../components/community/MembersPanel';
import { useToast } from '../context/Toast';
import { useConfirm } from '../context/Confirm';
import { useAuth } from '../lib/auth';
import {
  addOwner,
  adminCommunities,
  adminUsers,
  createCommunity,
  deleteCommunity,
  removeOwner,
  setUserStatus,
  updateCommunity,
  type AccountStatus,
  type AdminUser,
  type Community,
} from '../lib/community';
import NotFound from './NotFound';

type Tab = 'users' | 'communities';

const STATUS_STYLE: Record<AccountStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  inactive: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function Badge({ className, children }: { className: string; children: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${className}`}>{children}</span>;
}

function Loading() {
  return (
    <div className="flex justify-center py-12 text-zinc-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

/* ------------------------------------------------------------------ users */

function UsersTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const me = useAuth()?.user;
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ users: AdminUser[]; totals: Record<AccountStatus, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback((term: string) => {
    setError(null);
    adminUsers(term)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const change = async (u: AdminUser, status: AccountStatus) => {
    if (status !== 'active') {
      const ok = await confirm({
        title: status === 'blocked' ? `Block ${u.name || u.email}?` : `Set ${u.name || u.email} inactive?`,
        message:
          status === 'blocked'
            ? "They're logged out on every device and can't log in again. Their data is kept. You can unblock them later."
            : "They're logged out on every device and can't log in until the account is reactivated. Their data is kept.",
        confirmLabel: status === 'blocked' ? 'Block' : 'Set inactive',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(u.id);
    try {
      await setUserStatus(u.id, status);
      toast(status === 'active' ? 'Account activated' : status === 'blocked' ? 'Account blocked' : 'Account set inactive', { tone: 'success' });
      load(q);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Active" value={data.totals.active} />
          <StatTile label="Inactive" value={data.totals.inactive} />
          <StatTile label="Blocked" value={data.totals.blocked} />
        </div>
      )}
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input className="input !pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      </label>
      {error ? (
        <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !data ? (
        <Loading />
      ) : data.users.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="No users found" />
      ) : (
        <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
          {data.users.map((u) => {
            const self = u.id === me?.id;
            const items = (
              [
                u.status !== 'active' && { label: 'Activate', icon: <ShieldCheck size={16} />, onSelect: () => change(u, 'active') },
                u.status !== 'inactive' && { label: 'Set inactive', icon: <CircleOff size={16} />, onSelect: () => change(u, 'inactive') },
                u.status !== 'blocked' && { label: 'Block', icon: <Ban size={16} />, danger: true, onSelect: () => change(u, 'blocked') },
              ] as const
            ).filter((x) => !!x);
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-semibold">{u.name || '—'}</span>
                    <Badge className={STATUS_STYLE[u.status] ?? STATUS_STYLE.active}>{u.status}</Badge>
                    {u.role === 'admin' && <Badge className="bg-volt-500/15 text-steel dark:text-volt-400">admin</Badge>}
                    {self && <Badge className="bg-zinc-500/10 text-zinc-500">you</Badge>}
                  </div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Joined {format(u.createdAt, 'd MMM yyyy')}
                    {u.lastSeen ? ` · seen ${formatDistanceToNow(u.lastSeen, { addSuffix: true })}` : ' · not signed in'}
                    {u.communities > 0 && ` · ${u.communities} communit${u.communities === 1 ? 'y' : 'ies'}`}
                  </div>
                </div>
                {busy === u.id ? (
                  <Loader2 size={18} className="animate-spin text-zinc-400" />
                ) : (
                  !self && <Menu label={`Actions for ${u.name || u.email}`} trigger={<MoreVertical size={18} />} items={[...items]} />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && data.users.length >= 500 && <p className="text-center text-xs text-zinc-500">Showing the newest 500. Search to find others.</p>}
    </div>
  );
}

/* ------------------------------------------------------------ communities */

function CommunityForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Community | null; onSaved: (c: Community) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setLocation(initial?.location ?? '');
    }
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = initial ? await updateCommunity(initial.id, { name, location }) : await createCommunity(name, location);
      onSaved(c);
      onClose();
      toast(initial ? 'Community updated' : 'Community created', { tone: 'success' });
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit community' : 'New gym community'} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">Gym name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="e.g. Iron Temple Makati" />
        </label>
        <label className="block">
          <span className="label">Location (optional)</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} placeholder="Address or branch" />
        </label>
        <button className="btn-primary w-full" disabled={busy || !name.trim()}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save' : 'Create and get QR code'}
        </button>
      </form>
    </Modal>
  );
}

function OwnersModal({ community, onClose, onSaved }: { community: Community | null; onClose: () => void; onSaved: (c: Community) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(''), [community?.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setBusy(true);
    try {
      onSaved(await addOwner(community.id, email));
      setEmail('');
      toast('Gym owner added', { tone: 'success' });
    } catch (err) {
      toast((err as Error).message, { tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: number) => {
    if (!community) return;
    try {
      onSaved(await removeOwner(community.id, userId));
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  };

  return (
    <Modal open={!!community} onClose={onClose} title={community ? `${community.name} · Gym owners` : ''} size="sm">
      {community && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gym owners see this community's members and how often they train, and can block or unblock them. They can't create communities or change the QR code.</p>
          {community.owners.length === 0 ? (
            <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-500 dark:bg-zinc-800">No gym owners yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-100 dark:divide-zinc-800 dark:ring-zinc-800">
              {community.owners.map((o) => (
                <li key={o.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.name || '—'}</div>
                    <div className="truncate text-xs text-zinc-500">{o.email}</div>
                  </div>
                  <button className="icon-btn" aria-label={`Remove ${o.email}`} onClick={() => remove(o.id)}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex gap-2">
            <input className="input flex-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@email.com" required aria-label="Gym owner's email" />
            <button className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
            </button>
          </form>
          <p className="text-xs text-zinc-500">They need a Gymbulag account first. Access applies the next time their app refreshes.</p>
        </div>
      )}
    </Modal>
  );
}

function CommunitiesTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; edit: Community | null }>({ open: false, edit: null });
  const [qrId, setQrId] = useState<number | null>(null);
  const [ownersId, setOwnersId] = useState<number | null>(null);
  const [membersId, setMembersId] = useState<number | null>(null);

  const load = useCallback(() => {
    adminCommunities()
      .then(setList)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const put = (c: Community) => setList((l) => (l?.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...(l ?? [])]));
  const byId = useMemo(() => new Map((list ?? []).map((c) => [c.id, c])), [list]);

  const toggleJoin = async (c: Community, active: boolean) => {
    try {
      put(await updateCommunity(c.id, { active }));
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const remove = async (c: Community) => {
    const ok = await confirm({ title: `Delete ${c.name}?`, message: `All ${c.members} members are removed from it and its QR code stops working. Members keep their accounts and workout data.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteCommunity(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
      toast('Community deleted', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const membersOf = membersId ? byId.get(membersId) : null;

  return (
    <div className="space-y-4">
      <button className="btn-primary w-full sm:w-auto" onClick={() => setForm({ open: true, edit: null })}>
        <Plus size={16} /> New community
      </button>
      {error ? (
        <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !list ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState icon={<Building2 size={22} />} title="No communities yet">
          Create one for each gym. You'll get a QR code to put up at the gym; people who scan it join straight away.
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <article key={c.id} className="card space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-lg font-bold tracking-wide">{c.name}</h3>
                  {c.location && (
                    <p className="flex items-center gap-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      <MapPin size={12} /> {c.location}
                    </p>
                  )}
                </div>
                <Menu
                  label={`Actions for ${c.name}`}
                  trigger={<MoreVertical size={18} />}
                  items={[
                    { label: 'Edit details', icon: <UserCog size={16} />, onSelect: () => setForm({ open: true, edit: c }) },
                    { label: 'Delete community', icon: <Trash2 size={16} />, danger: true, onSelect: () => remove(c) },
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  <b className="tabular">{c.members}</b> members
                </span>
                <span>
                  <b className="tabular">{c.joinedThisWeek}</b> new this week
                </span>
                {c.blocked > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    <b className="tabular">{c.blocked}</b> blocked
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Owners: {c.owners.length ? c.owners.map((o) => o.name || o.email).join(', ') : <i>none yet</i>}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-100/70 px-3 py-2 dark:bg-white/[0.04]">
                <span className="text-sm font-medium">Accept new members by QR</span>
                <Toggle checked={c.active} onChange={(v) => toggleJoin(c, v)} label={`Accept new members for ${c.name}`} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className="btn-secondary !px-2" onClick={() => setQrId(c.id)}>
                  <QrCode size={16} /> QR
                </button>
                <button className="btn-secondary !px-2" onClick={() => setMembersId(c.id)}>
                  <Users size={16} /> Members
                </button>
                <button className="btn-secondary !px-2" onClick={() => setOwnersId(c.id)}>
                  <UserCog size={16} /> Owners
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <CommunityForm
        open={form.open}
        initial={form.edit}
        onClose={() => setForm({ open: false, edit: null })}
        onSaved={(c) => {
          put(c);
          if (!form.edit) setQrId(c.id);
        }}
      />
      <QrModal community={qrId ? byId.get(qrId) ?? null : null} onClose={() => setQrId(null)} onRegenerate={async () => {
          if (qrId) put(await updateCommunity(qrId, { regenerateCode: true }));
        }} />
      <OwnersModal community={ownersId ? byId.get(ownersId) ?? null : null} onClose={() => setOwnersId(null)} onSaved={put} />
      <Modal open={!!membersOf} onClose={() => setMembersId(null)} title={membersOf ? `${membersOf.name} · Members` : ''} size="lg">
        {membersOf && <MembersPanel communityId={membersOf.id} onChanged={load} />}
      </Modal>
    </div>
  );
}

export default function AdminPage() {
  const user = useAuth()?.user;
  const [tab, setTab] = useState<Tab>('users');
  if (user?.role !== 'admin') return <NotFound />;
  return (
    <>
      <PageHeader title="Admin" subtitle="Accounts and gym communities" />
      <div className="mx-auto max-w-app space-y-4 px-4 pt-4 lg:max-w-app-wide lg:px-8">
        <TabBar<Tab>
          ariaLabel="Admin sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'users', label: 'Users', icon: <Users size={16} /> },
            { value: 'communities', label: 'Gym communities', icon: <Building2 size={16} /> },
          ]}
        />
        {tab === 'users' ? <UsersTab /> : <CommunitiesTab />}
      </div>
    </>
  );
}
