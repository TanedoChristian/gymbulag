import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Globe, Loader2, MapPin, Search } from 'lucide-react';
import { EmptyState } from '../ui';
import { CommunityCover } from './CommunityCover';
import { useToast } from '../../context/Toast';
import { joinPublicCommunity, publicCommunities, type PublicCommunity } from '../../lib/community';

/** Public gym communities anyone can join without a QR code. */
export function DiscoverGyms({ onJoined }: { onJoined?: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [list, setList] = useState<PublicCommunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(
      () => {
        setError(null);
        publicCommunities(q.trim())
          .then(setList)
          .catch((e) => setError((e as Error).message));
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [q]);

  const join = async (c: PublicCommunity) => {
    setBusy(c.id);
    try {
      await joinPublicCommunity(c.id);
      setList((l) => l?.map((x) => (x.id === c.id ? { ...x, joined: true, members: x.members + 1 } : x)) ?? null);
      toast(`You joined ${c.name}`, { tone: 'success' });
      onJoined?.();
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-mute" />
        <input className="input !pl-9" placeholder="Search gyms by name or area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search gyms" />
      </label>

      {error ? (
        <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !list ? (
        <div className="flex justify-center py-12 text-steel-mute">
          <Loader2 className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Globe size={24} />} title={q ? 'No gyms match' : 'No public gyms yet'}>
          {q ? 'Try another name or area.' : "Gyms appear here when they open their community to everyone. Private gyms can only be joined with their QR code."}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="card flex items-center gap-3 p-3.5">
              <CommunityCover name={c.name} coverKey={c.coverKey} className="h-12 w-20 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold leading-tight">{c.name}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-steel-mute dark:text-floor-mute">
                  {c.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {c.location}
                    </span>
                  )}
                  <span>
                    {c.members} member{c.members === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
              {c.joined ? (
                <Link to={`/community/${c.id}`} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-400">
                  <Check size={14} /> Open
                </Link>
              ) : (
                <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => join(c)} disabled={busy === c.id}>
                  {busy === c.id && <Loader2 size={14} className="animate-spin" />} Join
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs text-steel-mute dark:text-floor-mute">When you join, the gym can see your name, email, picture, when you joined and how often you log workouts.</p>
    </div>
  );
}
