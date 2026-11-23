import { ApiError, api } from './api';

export type NearbyGym = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  kind: string;
};

export type NearbyGymsResult = {
  lat: number;
  lon: number;
  radiusM: number;
  gyms: NearbyGym[];
};

export const NEARBY_RADII_M = [
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
] as const;

/** Race a few public Overpass mirrors — first good response wins. */
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const FETCH_MS = 12_000;

let cachedPosition: { lat: number; lon: number; at: number } | null = null;
const POSITION_TTL_MS = 5 * 60_000;

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Opens native maps when possible; Google Maps otherwise. */
export function mapsDirectionsUrl(gym: Pick<NearbyGym, 'lat' | 'lon' | 'name'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${gym.lat},${gym.lon}`;
}

export function mapsPlaceUrl(gym: Pick<NearbyGym, 'lat' | 'lon' | 'name'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${gym.lat},${gym.lon}`;
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function gymAddress(tags: Record<string, string>): string | null {
  const line = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  const city = tags['addr:city'] || tags['addr:suburb'];
  return [line || tags['addr:full'], city].filter(Boolean).join(', ') || null;
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function parseOverpassGyms(elements: OverpassElement[], lat: number, lon: number, radiusM: number): NearbyGymsResult {
  const seen = new Set<string>();
  const gyms: NearbyGym[] = [];
  for (const el of elements) {
    const gLat = el.lat ?? el.center?.lat;
    const gLon = el.lon ?? el.center?.lon;
    if (gLat == null || gLon == null) continue;
    const tags = el.tags ?? {};
    const name = (tags.name || tags.brand || '').trim() || 'Unnamed gym';
    const key = `${name.toLowerCase()}|${gLat.toFixed(5)}|${gLon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    gyms.push({
      id: `${el.type}/${el.id}`,
      name,
      lat: gLat,
      lon: gLon,
      distanceKm: Math.round(haversineKm(lat, lon, gLat, gLon) * 100) / 100,
      address: gymAddress(tags),
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      hours: tags.opening_hours || null,
      kind: tags.leisure || tags.amenity || 'gym',
    });
  }
  gyms.sort((a, b) => a.distanceKm - b.distanceKm);
  return { lat, lon, radiusM, gyms: gyms.slice(0, 40) };
}

/** Nodes-only + simple tags — much faster than nwr + regex sport filters. */
function overpassQuery(lat: number, lon: number, radiusM: number): string {
  return `[out:json][timeout:10];
(
  node["leisure"="fitness_centre"](around:${radiusM},${lat},${lon});
  node["amenity"="gym"](around:${radiusM},${lat},${lon});
  way["leisure"="fitness_centre"](around:${radiusM},${lat},${lon});
);
out center tags 60;`;
}

async function fetchOneOverpass(endpoint: string, body: string, signal: AbortSignal): Promise<OverpassElement[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
    signal,
  });
  if (!res.ok) throw new Error(`Map service unavailable (${res.status})`);
  const data = (await res.json()) as { elements?: OverpassElement[] };
  return data.elements ?? [];
}

/** Race mirrors; abort losers when the first one returns. */
async function fetchNearbyGymsDirect(lat: number, lon: number, radiusM: number, outer?: AbortSignal): Promise<NearbyGymsResult> {
  const radius = Math.min(Math.max(radiusM || 5000, 500), 20_000);
  const body = `data=${encodeURIComponent(overpassQuery(lat, lon, radius))}`;
  const ctrl = new AbortController();
  const onOuterAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onOuterAbort);
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_MS);

  try {
    const elements = await Promise.any(
      OVERPASS_ENDPOINTS.map((endpoint) => fetchOneOverpass(endpoint, body, ctrl.signal)),
    );
    ctrl.abort(); // cancel siblings
    return parseOverpassGyms(elements, lat, lon, radius);
  } catch (e) {
    if (outer?.aborted || ctrl.signal.aborted) {
      if (outer?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error('Map search timed out. Try 5 km, or tap refresh.');
    }
    throw e instanceof Error ? e : new Error("Can't reach the map service right now.");
  } finally {
    window.clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}

export function getCurrentPosition(force = false): Promise<{ lat: number; lon: number }> {
  if (!force && cachedPosition && Date.now() - cachedPosition.at < POSITION_TTL_MS) {
    return Promise.resolve({ lat: cachedPosition.lat, lon: cachedPosition.lon });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device does not support location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, at: Date.now() };
        cachedPosition = next;
        resolve({ lat: next.lat, lon: next.lon });
      },
      (err) => {
        if (cachedPosition) {
          resolve({ lat: cachedPosition.lat, lon: cachedPosition.lon });
          return;
        }
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Location permission denied. Allow it in your browser settings, then try again.'));
        else if (err.code === err.TIMEOUT) reject(new Error('Location timed out. Move somewhere with a clearer signal and try again.'));
        else reject(new Error('Could not read your location.'));
      },
      // Low-accuracy first fix is much faster; good enough for gym search.
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 120_000 },
    );
  });
}

/**
 * Hit Overpass directly (fast path). Server proxy is optional and short-circuited —
 * waiting on a slow/down API before Overpass made 10 km feel stuck.
 */
export async function fetchNearbyGyms(
  lat: number,
  lon: number,
  radiusM: number,
  signal?: AbortSignal,
): Promise<NearbyGymsResult> {
  try {
    return await fetchNearbyGymsDirect(lat, lon, radiusM, signal);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    // Last resort: Gymbulag proxy (may be down — ignore quickly).
    try {
      return await api<NearbyGymsResult>(`/gyms/nearby?lat=${lat}&lon=${lon}&radius=${radiusM}`);
    } catch (apiErr) {
      if (apiErr instanceof ApiError && (apiErr.status === 401 || apiErr.status === 403)) throw apiErr;
      throw e;
    }
  }
}
