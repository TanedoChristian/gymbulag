import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, ExternalLink, MapPin, Navigation, Phone, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  NEARBY_RADII_M,
  fetchNearbyGyms,
  formatDistance,
  getCurrentPosition,
  mapsDirectionsUrl,
  mapsPlaceUrl,
  type NearbyGym,
  type NearbyGymsResult,
} from '../../lib/nearbyGyms';
import { EmptyState, Spinner } from '../ui';

type Status =
  | { state: 'idle' }
  | { state: 'locating' }
  | { state: 'searching' }
  | { state: 'ready'; result: NearbyGymsResult }
  | { state: 'error'; message: string };

/** Gyms around the user's location (OpenStreetMap). Shown in the Community tab. */
export function NearbyGyms() {
  const [radius, setRadius] = useState(5000);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [result, setResult] = useState<NearbyGymsResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const hasResultsRef = useRef(false);

  const search = useCallback(async (radiusM: number, opts?: { forceLocation?: boolean }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = ++seqRef.current;

    setStatus(hasResultsRef.current ? { state: 'searching' } : { state: 'locating' });

    try {
      const pos = await getCurrentPosition(opts?.forceLocation);
      if (seq !== seqRef.current) return;
      setStatus({ state: 'searching' });
      const next = await fetchNearbyGyms(pos.lat, pos.lon, radiusM, ctrl.signal);
      if (seq !== seqRef.current) return;
      hasResultsRef.current = next.gyms.length > 0;
      setResult(next);
      setStatus({ state: 'ready', result: next });
    } catch (e) {
      if (seq !== seqRef.current) return;
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const message = e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong';
      setStatus({ state: 'error', message });
    }
  }, []);

  useEffect(() => {
    void search(radius);
    return () => {
      abortRef.current?.abort();
      seqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRadius = (next: number) => {
    if (next === radius && status.state !== 'error') return;
    setRadius(next);
    void search(next);
  };

  const busy = status.state === 'locating' || status.state === 'searching';
  const showList = result && result.gyms.length > 0;
  const showEmptyReady = status.state === 'ready' && result && result.gyms.length === 0;

  return (
    <div className="space-y-4">
        <section className="hero-panel p-5 text-steel-bright">
          <div className="relative pl-2">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="eyebrow text-volt-500">Find a rack</div>
                <h2 className="mt-1 font-display text-3xl font-bold tracking-wide">Gyms near me</h2>
              </div>
              <button className="icon-btn text-steel-bright hover:bg-white/10" onClick={() => void search(radius, { forceLocation: true })} aria-label="Refresh nearby gyms">
                <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="mt-2 max-w-md text-sm text-floor-mute">
              Uses your location and OpenStreetMap. Change radius anytime — search cancels the previous one.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Search radius">
              {NEARBY_RADII_M.map((r) => {
                const on = radius === r.value;
                return (
                  <button
                    key={r.value}
                    role="radio"
                    aria-checked={on}
                    className={on ? 'chip-on !normal-case' : 'chip-off !normal-case'}
                    onClick={() => onRadius(r.value)}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {busy && (
              <p className="mt-3 text-xs font-semibold text-volt-400" aria-live="polite">
                {status.state === 'locating' ? 'Getting your location…' : `Scanning within ${formatDistance(radius / 1000)}…`}
              </p>
            )}
          </div>
        </section>

        {busy && !showList && (
          <div className="card px-4 py-8 text-center">
            <Spinner />
            <p className="mt-2 text-sm text-steel-mute dark:text-floor-mute">
              {status.state === 'locating' ? 'Getting your location…' : 'Scanning for gyms…'}
            </p>
          </div>
        )}

        {status.state === 'error' && !showList && (
          <EmptyState icon={<MapPin size={24} />} title="Couldn't find gyms">
            <p>{status.message}</p>
            <button className="btn-primary mt-4" onClick={() => void search(radius, { forceLocation: true })}>
              Try again
            </button>
          </EmptyState>
        )}

        {status.state === 'idle' && !showList && (
          <EmptyState icon={<Navigation size={24} />} title="Find gyms near you">
            <p>Allow location access to see fitness centres around you.</p>
            <button className="btn-primary mt-4" onClick={() => void search(radius)}>
              <MapPin size={16} /> Use my location
            </button>
          </EmptyState>
        )}

        {showEmptyReady && (
          <EmptyState icon={<MapPin size={24} />} title="No gyms in range">
            <p>Nothing mapped within {formatDistance(result.radiusM / 1000)}. Try a wider radius.</p>
          </EmptyState>
        )}

        {showList && (
          <section aria-label="Nearby gyms">
            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="eyebrow flex-1">
                {result.gyms.length} within {formatDistance(result.radiusM / 1000)}
              </div>
              {busy && <span className="text-[11px] font-semibold text-volt-700 dark:text-volt-400">Updating…</span>}
              {status.state === 'error' && (
                <button className="text-[11px] font-semibold link-accent" onClick={() => void search(radius)}>
                  Retry
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {result.gyms.map((gym, i) => (
                <li key={gym.id}>
                  <GymCard gym={gym} rank={i + 1} />
                </li>
              ))}
            </ul>
            <p className="mt-4 px-1 text-center text-[11px] text-steel-mute dark:text-floor-mute">
              Map data © OpenStreetMap contributors
            </p>
          </section>
        )}
    </div>
  );
}

function GymCard({ gym, rank }: { gym: NearbyGym; rank: number }) {
  return (
    <article className="card p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-rack text-volt-500">
          <span className="font-mono text-sm font-bold leading-none">{rank}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-bold leading-tight">{gym.name}</h3>
            <span className="shrink-0 font-mono text-sm font-bold tabular text-volt-700 dark:text-volt-400">
              {formatDistance(gym.distanceKm)}
            </span>
          </div>
          {gym.address && <p className="mt-1 truncate text-xs text-steel-mute dark:text-floor-mute">{gym.address}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-steel-mute dark:text-floor-mute">
            {gym.hours && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> <span className="truncate">{gym.hours}</span>
              </span>
            )}
            {gym.phone && (
              <a className="link-accent inline-flex items-center gap-1" href={`tel:${gym.phone}`}>
                <Phone size={12} /> Call
              </a>
            )}
            {gym.website && (
              <a className="link-accent inline-flex items-center gap-1" href={gym.website} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Site
              </a>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="btn-primary !px-3 !py-2 text-xs"
              href={mapsDirectionsUrl(gym)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={14} /> Directions
            </a>
            <a
              className="btn-secondary !px-3 !py-2 text-xs"
              href={mapsPlaceUrl(gym)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={14} /> Open map
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
