import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Building2, ChevronRight, Loader2, LogOut, MapPin, QrCode, Users } from 'lucide-react';
import { EmptyState, PageHeader, TabBar } from '../components/ui';
import { NearbyGyms } from '../components/community/NearbyGyms';
import { useToast } from '../context/Toast';
import { useConfirm } from '../context/Confirm';
import { useAuth } from '../lib/auth';
import { leaveCommunity, myCommunities, type MyCommunity } from '../lib/community';

type Tab = 'mine' | 'nearby';

/** The gym communities you joined (plus the gym-owner dashboard shortcut). */
function MyGyms() {
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
          Scan the QR code at your gym's front desk with your phone camera to join its community.
        </EmptyState>
      ) : (
        <section aria-label="Your gyms">
          <div className="eyebrow mb-2 px-1">Your gyms</div>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="card flex items-center gap-3 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rack text-volt-500">
                  <Users size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold leading-tight">{c.name}</h3>
                  {c.location && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-steel-mute dark:text-floor-mute">
                      <MapPin size={12} /> {c.location}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-steel-mute dark:text-floor-mute">Member since {format(c.joinedAt, 'd MMM yyyy')}</p>
                </div>
                <button className="btn-ghost !px-2.5 text-xs" onClick={() => leave(c)}>
                  <LogOut size={14} /> Leave
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-1 text-xs text-steel-mute dark:text-floor-mute">Your gym can see your name, email, when you joined and how often you log workouts.</p>
        </section>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'nearby' ? 'nearby' : 'mine';
  return (
    <>
      <PageHeader title="Community" subtitle={tab === 'nearby' ? 'Gyms around you' : 'Your gyms'} />
      <div className="mx-auto max-w-app space-y-4 px-4 pt-4 lg:max-w-app-wide lg:px-8">
        <TabBar<Tab>
          ariaLabel="Community sections"
          value={tab}
          onChange={(t) => setParams(t === 'mine' ? {} : { tab: t }, { replace: true })}
          tabs={[
            { value: 'mine', label: 'My gyms', icon: <Users size={16} /> },
            { value: 'nearby', label: 'Nearby', icon: <MapPin size={16} /> },
          ]}
        />
        {tab === 'mine' ? <MyGyms /> : <NearbyGyms />}
      </div>
    </>
  );
}
