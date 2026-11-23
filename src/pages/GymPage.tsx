import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, MapPin, QrCode } from 'lucide-react';
import { EmptyState, PageHeader, TabBar } from '../components/ui';
import { QrModal } from '../components/community/QrModal';
import { MembersPanel } from '../components/community/MembersPanel';
import { ownedCommunities, type Community } from '../lib/community';

/** Gym owners: the communities an admin gave them access to, and who's in them. */
export default function GymPage() {
  const [list, setList] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [qr, setQr] = useState(false);

  const load = useCallback(() => {
    ownedCommunities()
      .then((l) => {
        setList(l);
        setSelected((s) => (s && l.some((c) => String(c.id) === s) ? s : l[0] ? String(l[0].id) : ''));
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const current = list?.find((c) => String(c.id) === selected) ?? null;

  return (
    <>
      <PageHeader
        title="My gym"
        subtitle={current ? current.name : 'Your gym communities'}
        right={
          current && (
            <button className="btn-secondary" onClick={() => setQr(true)}>
              <QrCode size={16} /> QR code
            </button>
          )
        }
      />
      <div className="mx-auto max-w-app space-y-4 px-4 pt-4 lg:max-w-app-wide lg:px-8">
        {error ? (
          <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !list ? (
          <div className="flex justify-center py-12 text-zinc-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Building2 size={22} />} title="No gym access yet">
            When Gymbulag gives you access to your gym's community, its members show up here.
          </EmptyState>
        ) : (
          <>
            {list.length > 1 && <TabBar ariaLabel="Your gyms" value={selected} onChange={setSelected} tabs={list.map((c) => ({ value: String(c.id), label: c.name }))} />}
            {current && (
              <>
                {(current.location || !current.active || current.visibility) && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {current.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {current.location}
                      </span>
                    )}
                    <span className="rounded bg-steel/[0.07] px-2 py-0.5 font-semibold dark:bg-white/[0.06]">
                      {current.visibility === 'public' ? 'Public · listed in Discover' : 'Private · join by QR code'}
                    </span>
                    {!current.active && <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">Deactivated: new members can't join</span>}
                  </div>
                )}
                <MembersPanel key={current.id} communityId={current.id} />
              </>
            )}
          </>
        )}
      </div>
      <QrModal community={qr ? current : null} onClose={() => setQr(false)} />
    </>
  );
}
