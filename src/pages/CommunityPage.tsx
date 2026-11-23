import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Building2, ChevronRight, Compass, Loader2, LogOut, MapPin, QrCode, ShieldCheck, Users } from 'lucide-react';
import { EmptyState, PageHeader, TabBar } from '../components/ui';
import { NearbyGyms } from '../components/community/NearbyGyms';
import { DiscoverGyms } from '../components/community/DiscoverGyms';
import { CommunityCover } from '../components/community/CommunityCover';
import { useToast } from '../context/Toast';
import { useConfirm } from '../context/Confirm';
import { useAuth } from '../lib/auth';
import { leaveCommunity, myCommunities, type MyCommunity } from '../lib/community';

type Tab = 'mine' | 'discover' | 'nearby';

/** The gym communities you joined (plus admin panel / gym-owner dashboard shortcuts). */
function MyGyms({ onDiscover }: { onDiscover: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuth()?.user;
  const [list, setList] = useState<MyCommunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myCommunities()
      .then(setList)
      .catch((e) => setError((e as Error).message));
  }, []);

  const leave = async (c: MyCommunity) => {
    const ok = await confirm({ title: `Leave ${c.name}?`, message: 'The gym will no longer see your activity. Scan their QR code again to rejoin.', confirmLabel: 'Leave' });
    if (!ok) return;
    try {
      await leaveCommunity(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
      toast(`You left ${c.name}`, { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const links = [
    user?.role === 'admin' && { to: '/admin', icon: <ShieldCheck size={18} />, title: 'Admin panel', desc: 'Users, gym communities and login activity' },
    user?.isOwner && { to: '/gym', icon: <Building2 size={18} />, title: 'My gym dashboard', desc: 'Track and manage your members' },
  ].filter((x): x is { to: string; icon: JSX.Element; title: string; desc: string } => !!x);

  return (
    <div className="space-y-4">
      {links.length > 0 && (
        <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rack text-volt-500">{l.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{l.title}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{l.desc}</span>
              </span>
              <ChevronRight size={18} className="text-zinc-400" />
            </Link>
          ))}
        </div>
      )}

      {error ? (
        <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !list ? (
        <div className="flex justify-center py-12 text-zinc-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<QrCode size={24} />} title="You haven't joined a gym yet">
          <p>Scan the QR code at your gym's front desk with your phone camera to join its community.</p>
          <button className="btn-secondary mt-4" onClick={onDiscover}>
            <Compass size={16} /> Browse public gyms
          </button>
        </EmptyState>
      ) : (
        <section aria-label="Your gyms">
          <div className="eyebrow mb-2 px-1">Your gyms</div>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="card card-hover flex items-center gap-3 p-3.5">
                <Link to={`/community/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Open ${c.name} community`}>
                <CommunityCover name={c.name} coverKey={c.coverKey} className="h-12 w-20 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 truncate font-bold leading-tight">
                    {c.name}
                    {!c.active && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Paused</span>}
                  </h3>
                  {c.location && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-steel-mute dark:text-floor-mute">
                      <MapPin size={12} /> {c.location}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-steel-mute dark:text-floor-mute">Member since {format(c.joinedAt, 'd MMM yyyy')}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-steel-mute" />
                </Link>
                <button className="btn-ghost !px-2.5 text-xs" onClick={() => leave(c)}>
                  <LogOut size={14} /> Leave
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-1 text-xs text-steel-mute dark:text-floor-mute">Tap a gym to see its feed and members. Your gym can see your name, email, when you joined and how often you log workouts.</p>
        </section>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab: Tab = t === 'nearby' || t === 'discover' ? t : 'mine';
  const go = (next: Tab) => setParams(next === 'mine' ? {} : { tab: next }, { replace: true });
  return (
    <>
      <PageHeader title="Community" subtitle={tab === 'nearby' ? 'Gyms around you' : tab === 'discover' ? 'Public gyms you can join' : 'Your gyms'} />
      <div className="mx-auto max-w-app space-y-4 px-4 pt-4 lg:max-w-app-wide lg:px-8">
        <TabBar<Tab>
          ariaLabel="Community sections"
          value={tab}
          onChange={go}
          tabs={[
            { value: 'mine', label: 'My gyms', icon: <Users size={16} /> },
            { value: 'discover', label: 'Discover', icon: <Compass size={16} /> },
            { value: 'nearby', label: 'Nearby', icon: <MapPin size={16} /> },
          ]}
        />
        {tab === 'mine' ? <MyGyms onDiscover={() => go('discover')} /> : tab === 'discover' ? <DiscoverGyms /> : <NearbyGyms />}
      </div>
    </>
  );
}
