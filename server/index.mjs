#!/usr/bin/env node
// Gymbulag sync server: stores the app's data in Postgres (Supabase) and serves the built app.
// On Vercel the same handler runs as a function (api/index.mjs).
//   npm run db:migrate   create / upgrade the tables
//   npm run server       start on PORT (default 8787)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config, databaseLabel } from './config.mjs';
import { createPool } from './db.mjs';
import { migrate } from './migrate.mjs';
import { TABLES, pullSince, applyChanges, counts } from './sync.mjs';
import { AuthError, adminSessionFromApp, changePassword, login, logout, register, requireUser, updateAvatar, updateProfile } from './auth.mjs';
import { serveAvatar } from './profile.mjs';
import { routeCommunity, serveCover } from './community.mjs';
import { routeFeed, serveMedia } from './feed.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MAX_BODY = 64 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(json);
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  // Lets an https page reach a server on the local network (Chrome Private Network Access).
  if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function clientInfo(req) {
  // Behind a tunnel / proxy the socket address is the proxy's, so prefer the forwarded one.
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return { ip: fwd || req.socket.remoteAddress || '?', device: String(req.headers['user-agent'] ?? '') };
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large');
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) return send(res, 404, { error: 'Not found' });
  let info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) {
    // SPA fallback for client-side routes; real missing assets 404.
    if (path.extname(url.pathname)) return send(res, 404, { error: 'Not found' });
    file = path.join(DIST, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) return send(res, 404, { error: 'App not built yet — run `npm run build`.' });
  }
  const ext = path.extname(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(await readFile(file));
}

// Open Food Facts name search. Their search service doesn't send CORS headers, so the app asks us instead.
const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,checked';
async function searchOpenFoodFacts(q) {
  const query = String(q).trim().slice(0, 100);
  if (query.length < 2) return [];
  let r;
  try {
    r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=25&fields=${OFF_FIELDS}`, {
      headers: { 'User-Agent': 'Gymbulag/1.0 (self-hosted personal workout log)' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(502, "The server can't reach Open Food Facts right now");
  }
  if (!r.ok) throw new HttpError(502, `Open Food Facts search is unavailable (${r.status})`);
  const data = await r.json();
  return (data.hits ?? []).filter((h) => h?.nutriments && (h.nutriments['energy-kcal_100g'] != null || h.nutriments['energy-kj_100g'] != null));
}


// Nearby gyms via OpenStreetMap Overpass (no API key). Browser calls us to avoid CORS + keep the query private.
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const GYM_RADIUS_MAX_M = 20_000;

function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function gymAddress(tags = {}) {
  const line = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  const city = [tags['addr:city'], tags['addr:suburb']].filter(Boolean)[0];
  return [line || tags['addr:full'], city].filter(Boolean).join(', ') || null;
}

async function searchNearbyGyms(lat, lon, radiusM) {
  const latN = Number(lat);
  const lonN = Number(lon);
  const radius = Math.min(Math.max(Number(radiusM) || 5000, 500), GYM_RADIUS_MAX_M);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN) || Math.abs(latN) > 90 || Math.abs(lonN) > 180) {
    throw new HttpError(400, 'Valid lat and lon are required');
  }
  const query = `[out:json][timeout:10];
(
  node["leisure"="fitness_centre"](around:${radius},${latN},${lonN});
  node["amenity"="gym"](around:${radius},${latN},${lonN});
  way["leisure"="fitness_centre"](around:${radius},${latN},${lonN});
);
out center tags 60;`;
  let r;
  try {
    r = await fetch(OVERPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Gymbulag/1.0 (self-hosted personal workout log)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(14_000),
    });
  } catch {
    throw new HttpError(502, "Can't reach the map service right now. Try again in a moment.");
  }
  if (!r.ok) throw new HttpError(502, `Map service unavailable (${r.status})`);
  const data = await r.json();
  const seen = new Set();
  const gyms = [];
  for (const el of data.elements ?? []) {
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
      distanceKm: Math.round(haversineKm(latN, lonN, gLat, gLon) * 100) / 100,
      address: gymAddress(tags),
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      hours: tags.opening_hours || null,
      kind: tags.leisure || tags.amenity || 'gym',
    });
  }
  gyms.sort((a, b) => a.distanceKm - b.distanceKm);
  return { lat: latN, lon: lonN, radiusM: radius, gyms: gyms.slice(0, 40) };
}

export function createServer(pool) {
  return http.createServer(createHandler(pool));
}

/** The request handler on its own, so the Vite dev server can run the API in-process. */
export function createHandler(pool) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
        return await serveStatic(req, res);
      }
      cors(req, res);
      if (req.method === 'OPTIONS') return res.writeHead(204).end();

      if (url.pathname === '/api/health' && req.method === 'GET') {
        return send(res, 200, { ok: true, app: 'gymbulag', accounts: true, signupCode: !!config.signupCode });
      }
      const avatar = url.pathname.match(/^\/api\/avatars\/([^/]+)$/);
      if (avatar && req.method === 'GET') return await serveAvatar(pool, avatar[1], res);
      const media = url.pathname.match(/^\/api\/community-media\/([^/]+)$/);
      if (media && req.method === 'GET') return await serveMedia(pool, media[1], res);
      const cover = url.pathname.match(/^\/api\/community-covers\/([^/]+)$/);
      if (cover && req.method === 'GET') return await serveCover(pool, cover[1], res);
      if (url.pathname === '/api/auth/register' && req.method === 'POST') return send(res, 201, await register(pool, await readJson(req), clientInfo(req)));
      if (url.pathname === '/api/auth/login' && req.method === 'POST') return send(res, 200, await login(pool, await readJson(req), clientInfo(req)));
      if (url.pathname === '/api/admin/login' && req.method === 'POST') return send(res, 200, await login(pool, await readJson(req), clientInfo(req), { adminOnly: true }));

      // Everything below needs a logged-in user.
      const auth = await requireUser(pool, req);
      const userId = auth.user.id;

      if (url.pathname === '/api/auth/me' && req.method === 'GET') {
        return send(res, 200, { user: auth.user, database: databaseLabel(), counts: await counts(pool, userId) });
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') return send(res, 200, await logout(pool, auth));
      if (url.pathname === '/api/auth/avatar' && req.method === 'POST') return send(res, 200, await updateAvatar(pool, auth, await readJson(req)));
      if (url.pathname === '/api/auth/profile' && req.method === 'POST') return send(res, 200, await updateProfile(pool, auth, await readJson(req)));
      if (url.pathname === '/api/admin/session' && req.method === 'POST') return send(res, 200, await adminSessionFromApp(pool, auth, clientInfo(req)));
      if (url.pathname === '/api/auth/password' && req.method === 'POST') return send(res, 200, await changePassword(pool, auth, await readJson(req)));

      if (url.pathname === '/api/food/search' && req.method === 'GET') {
        return send(res, 200, { products: await searchOpenFoodFacts(url.searchParams.get('q') ?? '') });
      }

      if (url.pathname === '/api/gyms/nearby' && req.method === 'GET') {
        return send(
          res,
          200,
          await searchNearbyGyms(url.searchParams.get('lat'), url.searchParams.get('lon'), url.searchParams.get('radius') ?? '5000'),
        );
      }

      const feedOut = await routeFeed(pool, auth, req, url, () => readJson(req));
      if (feedOut !== undefined) return send(res, 200, feedOut);
      const community = await routeCommunity(pool, auth, req, url, () => readJson(req));
      if (community !== undefined) return send(res, 200, community);

      const m = url.pathname.match(/^\/api\/sync\/([a-z]+)$/);
      if (m && req.method === 'POST') {
        const table = TABLES[m[1]];
        if (!table) throw new HttpError(404, `Unknown table ${m[1]}`);
        const body = await readJson(req);
        const since = Number(body.since) || 0;
        const upserts = Array.isArray(body.upserts) ? body.upserts : [];
        const deletes = Array.isArray(body.deletes) ? body.deletes.map(String) : [];
        // Pull first, so the client isn't sent back the rows it is pushing right now.
        const pulled = await pullSince(pool, userId, table, since);
        const pushedIds = new Set([...upserts.map((r) => String(r?.[table.key])), ...deletes]);
        const result = await applyChanges(pool, userId, table, upserts, deletes);
        // Rows the server refused (it had a newer version) come back so the client adopts the winner.
        const rows = pulled.rows.filter((r) => !pushedIds.has(String(r[table.key]))).concat(result.rejected.filter((x) => x.row).map((x) => x.row));
        const deleted = pulled.deleted.filter((id) => !pushedIds.has(id)).concat(result.rejected.filter((x) => x.deleted).map((x) => x.deleted));
        const rev = pulled.more ? pulled.rev : Math.max(pulled.rev, result.rev);
        return send(res, 200, { rows, deleted, rev, more: pulled.more, accepted: result.accepted });
      }
      throw new HttpError(404, 'Not found');
    } catch (e) {
      const status = e instanceof HttpError || e instanceof AuthError ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Server error — see the server log' : e.message });
      else res.end();
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await migrate({ log: (s) => console.log(`[db] ${s}`) });
  } catch (e) {
    console.error(`[db] ✗ ${e.message}`);
    if (e.code === '28P01') console.error('     Check the password in DATABASE_URL');
    if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('     Check DB_USER / DB_PASSWORD in .env');
    process.exit(1);
  }
  const pool = createPool();
  createServer(pool).listen(config.port, config.host, () => {
    console.log(`Gymbulag server on http://localhost:${config.port}  (${databaseLabel()})`);
    if (!config.signupCode) console.log('Tip: anyone who can reach this server can create an account. Set SIGNUP_CODE in .env to require a code.');
  });
}
