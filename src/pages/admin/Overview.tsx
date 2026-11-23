import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowRight, Building2, KeyRound, ShieldAlert, UserCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getOverview, REASON_LABEL, STATUS_LABEL, type Overview as Data } from '../../lib/admin';
import { Avatar, Badge, EmptyRow, ErrorBlock, LoadingBlock, PageTitle, Panel, Table, Td, Tr } from './kit';

/* Validated pair (see dataviz validator): light #4f6000 / #ff6e40, dark #84a200 / #b5340f. */
const CHART = {
  light: { ok: '#4f6000', failed: '#ff6e40', grid: 'rgba(17,20,24,0.08)', axis: '#6b7280', surface: '#eceff3' },
  dark: { ok: '#84a200', failed: '#b5340f', grid: 'rgba(255,255,255,0.07)', axis: '#8a919c', surface: '#111418' },
};

const subscribeDark = (fn: () => void) => {
  const o = new MutationObserver(fn);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => o.disconnect();
};
const useDark = () => useSyncExternalStore(subscribeDark, () => document.documentElement.classList.contains('dark'));

function Stat({ label, value, sub, icon, to }: { label: string; value: number; sub?: string; icon: JSX.Element; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel-mute dark:text-floor-mute">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-rack text-volt-500">{icon}</span>
      </div>
      <div className="mt-2 font-mono text-3xl font-bold tabular leading-none">{value.toLocaleString()}</div>
      {sub && <div className="mt-1.5 text-xs text-steel-mute dark:text-floor-mute">{sub}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="card card-hover block p-4">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

function LoginsChart({ days }: { days: Data['logins']['days'] }) {
  const c = CHART[useDark() ? 'dark' : 'light'];
  const data = days.map((d) => ({ ...d, label: format(parseISO(d.date), 'd MMM') }));
  const total = days.reduce((a, d) => a + d.ok + d.failed, 0);
  return (
    <Panel
      title="Sign-ins, last 14 days"
      actions={
        <div className="flex items-center gap-3 text-xs text-steel-mute dark:text-floor-mute" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.ok }} /> Successful
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.failed }} /> Failed
          </span>
        </div>
      }
    >
      <div className="h-56" role="img" aria-label={`Sign-ins per day for the last 14 days, ${total} in total`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} width={40} />
            <Tooltip
              cursor={{ fill: c.grid }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-steel/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-rack-soft dark:text-white">
                    <div className="mb-1 font-semibold">{label}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: c.ok }} /> Successful <b className="ml-auto pl-3 tabular">{payload[0]?.payload.ok}</b>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm" style={{ background: c.failed }} /> Failed <b className="ml-auto pl-3 tabular">{payload[0]?.payload.failed}</b>
                    </div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="ok" name="Successful" stackId="s" fill={c.ok} stroke={c.surface} strokeWidth={1} maxBarSize={28} />
            <Bar dataKey="failed" name="Failed" stackId="s" fill={c.failed} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    getOverview()
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <LoadingBlock />;
  const { users, communities, logins } = data;

  return (
    <>
      <PageTitle title="Overview" desc={`As of ${format(Date.now(), 'EEEE d MMMM, HH:mm')}`} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Users" value={users.total} sub={`${users.newThisWeek} new this week`} icon={<Users size={16} />} to="/admin/users" />
        <Stat label="Active today" value={users.activeToday} sub={`${users.inactive} deactivated · ${users.blocked} blocked`} icon={<UserCheck size={16} />} to="/admin/users" />
        <Stat label="Communities" value={communities.total} sub={`${communities.active} active · ${communities.members.toLocaleString()} members`} icon={<Building2 size={16} />} to="/admin/communities" />
        <Stat label="Sign-ins today" value={logins.today} sub={`${logins.failedToday} failed`} icon={<KeyRound size={16} />} to="/admin/logins" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_20rem]">
        <LoginsChart days={logins.days} />
        <Panel title="Roles">
          <dl className="space-y-3 text-sm">
            {[
              { label: 'Admins', value: users.admins, tone: 'volt' as const },
              { label: 'Gym owners', value: users.owners, tone: 'blue' as const },
              { label: 'Members', value: users.total - users.admins, tone: 'gray' as const },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <dt>
                  <Badge tone={r.tone}>{r.label}</Badge>
                </dt>
                <dd className="font-mono font-bold tabular">{r.value}</dd>
              </div>
            ))}
            <div className="border-t border-steel/10 pt-3 dark:border-white/[0.06]">
              {(['active', 'inactive', 'blocked'] as const).map((s) => (
                <div key={s} className="flex items-center justify-between py-0.5">
                  <dt className="text-steel-mute dark:text-floor-mute">{STATUS_LABEL[s]}</dt>
                  <dd className="font-mono tabular">{users[s]}</dd>
                </div>
              ))}
            </div>
          </dl>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Newest users"
          flush
          actions={
            <Link to="/admin/users" className="link-accent inline-flex items-center gap-1 text-xs font-semibold">
              All users <ArrowRight size={12} />
            </Link>
          }
        >
          <Table minWidth={420}>
            <tbody>
              {data.recentUsers.length === 0 && <EmptyRow cols={2}>No users yet</EmptyRow>}
              {data.recentUsers.map((u) => (
                <Tr key={u.id} onClick={() => navigate(`/admin/users?user=${u.id}`)}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name || u.email} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{u.name || '—'}</div>
                        <div className="truncate text-xs text-steel-mute dark:text-floor-mute">{u.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-steel-mute dark:text-floor-mute">{formatDistanceToNow(u.createdAt, { addSuffix: true })}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel
          title={
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert size={15} className="text-plate-600" /> Recent failed sign-ins
            </span>
          }
          flush
          actions={
            <Link to="/admin/logins?result=failed" className="link-accent inline-flex items-center gap-1 text-xs font-semibold">
              Login activity <ArrowRight size={12} />
            </Link>
          }
        >
          <Table minWidth={420}>
            <tbody>
              {data.recentFailures.length === 0 && <EmptyRow cols={3}>No failed sign-ins</EmptyRow>}
              {data.recentFailures.map((e) => (
                <Tr key={e.id}>
                  <Td>
                    <div className="truncate font-medium">{e.email || '—'}</div>
                    <div className="text-xs text-steel-mute dark:text-floor-mute">{e.ip || 'unknown IP'}</div>
                  </Td>
                  <Td>
                    <Badge tone="red">{REASON_LABEL[e.reason] ?? e.reason}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-steel-mute dark:text-floor-mute">{formatDistanceToNow(e.at, { addSuffix: true })}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>
    </>
  );
}

