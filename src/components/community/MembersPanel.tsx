import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Ban, CalendarCheck, Loader2, MoreVertical, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Menu } from '../Menu';
import { EmptyState, Segmented, StatTile } from '../ui';
import { useToast } from '../../context/Toast';
import { useConfirm } from '../../context/Confirm';
import { communityMembers, setMemberStatus, type Member } from '../../lib/community';

type Filter = 'all' | 'active' | 'blocked';

/** Who joined a community, how much they train, and block / unblock. Used by admins and gym owners. */
export function MembersPanel({ communityId, onChanged, asAdmin = false }: { communityId: number; onChanged?: () => void; asAdmin?: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    setError(null);
    communityMembers(communityId, asAdmin)
      .then((r) => setMembers(r.members))
      .catch((e) => setError((e as Error).message));
  }, [communityId, asAdmin]);

  useEffect(() => {
    setMembers(null);
    load();
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (members ?? []).filter((m) => (filter === 'all' || m.status === filter) && (!term || m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)));
  }, [members, q, filter]);

  const stats = useMemo(() => {
    const list = members ?? [];
    const active = list.filter((m) => m.status === 'active');
    const weekAgo = Date.now() - 7 * 864e5;
    return {
      members: active.length,
      training: active.filter((m) => m.sessions30 > 0).length,
      newThisWeek: active.filter((m) => m.joinedAt >= weekAgo).length,
      blocked: list.length - active.length,
    };
  }, [members]);

  const change = async (m: Member, status: Member['status']) => {
    if (status === 'blocked') {
      const ok = await confirm({ title: `Block ${m.name || m.email}?`, message: "They're removed from this community and can't rejoin by scanning the QR code. You can unblock them later.", confirmLabel: 'Block', danger: true });
      if (!ok) return;
    }
    setBusy(m.userId);
    try {
      await setMemberStatus(communityId, m.userId, status, asAdmin);
      setMembers((list) => list?.map((x) => (x.userId === m.userId ? { ...x, status, blockedAt: status === 'blocked' ? Date.now() : null } : x)) ?? null);
      toast(status === 'blocked' ? 'Member blocked' : 'Member unblocked', { tone: 'success' });
      onChanged?.();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (error)
    return (
      <div className="card space-y-2 p-4 text-sm">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button className="btn-secondary" onClick={load}>
          Try again
        </button>
      </div>
    );
  if (!members)
    return (
      <div className="flex justify-center py-10 text-zinc-400">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Members" value={stats.members} icon={<Users size={16} />} />
        <StatTile label="Trained (30 days)" value={stats.training} sub={stats.members ? `${Math.round((stats.training / stats.members) * 100)}% of members` : undefined} icon={<CalendarCheck size={16} />} />
        <StatTile label="New this week" value={stats.newThisWeek} icon={<UserPlus size={16} />} />
        <StatTile label="Blocked" value={stats.blocked} icon={<Ban size={16} />} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="input !pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        </label>
        <Segmented<Filter>
          ariaLabel="Filter members"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={members.length ? 'No one matches' : 'No members yet'}>
          {members.length ? 'Try a different search or filter.' : 'People appear here once they scan the community QR code.'}
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
          {shown.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-display text-sm font-bold uppercase dark:bg-zinc-800">{(m.name || m.email).slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-semibold">{m.name || '—'}</span>
                  {m.status === 'blocked' && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:text-red-400">Blocked</span>}
                  {m.accountStatus !== 'active' && <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">Account {m.accountStatus}</span>}
                </div>
                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{m.email}</div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Joined {format(m.joinedAt, 'd MMM yyyy')} · {m.sessions30} workout{m.sessions30 === 1 ? '' : 's'} in 30 days
                  {m.lastWorkout && ` · last ${format(parseISO(m.lastWorkout), 'd MMM')}`}
                  {m.lastSeen && ` · seen ${formatDistanceToNow(m.lastSeen, { addSuffix: true })}`}
                </div>
              </div>
              {busy === m.userId ? (
                <Loader2 size={18} className="animate-spin text-zinc-400" />
              ) : (
                <Menu
                  label={`Actions for ${m.name || m.email}`}
                  trigger={<MoreVertical size={18} />}
                  items={
                    m.status === 'blocked'
                      ? [{ label: 'Unblock', icon: <ShieldCheck size={16} />, onSelect: () => change(m, 'active') }]
                      : [{ label: 'Block from community', icon: <Ban size={16} />, danger: true, onSelect: () => change(m, 'blocked') }]
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
