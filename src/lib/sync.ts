import Dexie, { type Table } from 'dexie';
import { api, getAuth, isSignedIn, setAuth, subscribeAuth, type User } from './api';
import { db, type SyncStateRow } from '../db';
import { base64ToBuffer, bufferToBase64 } from './photos';
import type { Photo } from '../types';

const LAST_KEY = 'gymbulag:sync:last';

export interface ServerInfo {
  user: User;
  database: string;
  counts: Record<'sessions' | 'exercises' | 'templates' | 'settings' | 'photos' | 'activities' | 'foods' | 'foodlog' | 'weights', number>;
}

/** Your account and how much of your data the server holds. Also refreshes the cached profile. */
export async function fetchMe(): Promise<ServerInfo> {
  const info = await api<ServerInfo>('/auth/me');
  const cur = getAuth();
  if (cur && cur.user.id === info.user.id) setAuth({ ...cur, user: info.user });
  return info;
}

/* ------------------------------------------------------------------ tables */

/** Stable JSON (sorted keys) so the fingerprint doesn't depend on key order. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Spec {
  name: 'sessions' | 'exercises' | 'templates' | 'settings' | 'photos' | 'activities' | 'foods' | 'foodlog' | 'weights';
  key: string;
  batch: number;
  hash: (row: any) => string;
  toWire: (row: any) => unknown;
  fromWire: (row: any) => any;
}

const plain = (name: Spec['name'], key: string, batch = 200): Spec => ({
  name,
  key,
  batch,
  hash: (r) => fnv1a(stable(r)),
  toWire: (r) => r,
  fromWire: (r) => r,
});

// Exercises first: sessions and templates refer to them.
const SPECS: Spec[] = [
  plain('exercises', 'id', 500),
  plain('templates', 'id'),
  plain('sessions', 'id'),
  plain('activities', 'id', 500),
  plain('foods', 'id', 500),
  plain('foodlog', 'id', 500),
  plain('weights', 'date', 1000),
  plain('settings', 'key'),
  {
    name: 'photos',
    key: 'date',
    batch: 3,
    hash: (p: Photo) => `${p.updatedAt}:${p.data.byteLength}:${p.thumb.byteLength}`,
    toWire: (p: Photo) => ({ ...p, data: bufferToBase64(p.data), thumb: bufferToBase64(p.thumb) }),
    fromWire: (p): Photo => ({ ...p, data: base64ToBuffer(p.data), thumb: base64ToBuffer(p.thumb) }),
  },
];

interface SyncResponse {
  rows: any[];
  deleted: string[];
  rev: number;
  more: boolean;
  accepted: string[];
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  removed: number;
}

/** pushOnly: just upload this device's changes (skips the table when there are none, and doesn't page through downloads). */
async function syncTable(spec: Spec, out: SyncResult, pushOnly = false): Promise<void> {
  const table = db.table(spec.name) as Table<any, string>;
  const state: SyncStateRow = (await db.syncState.get(spec.name)) ?? { table: spec.name, cursor: 0, hashes: {} };
  const hashes = { ...state.hashes };
  const local = await table.toArray();
  const startHash = new Map<string, string>(local.map((r) => [String(r[spec.key]), spec.hash(r)]));

  // What changed here since we last agreed with the server.
  const queue = local.filter((r) => startHash.get(String(r[spec.key])) !== hashes[String(r[spec.key])]);
  const pending = new Set(queue.map((r) => String(r[spec.key])));
  const removed = Object.keys(hashes).filter((id) => !startHash.has(id));
  if (pushOnly && !queue.length && !removed.length) return;

  let cursor = state.cursor;
  let first = true;
  let more = false;
  do {
    const batch = queue.splice(0, spec.batch);
    const deletes = first ? removed : [];
    first = false;
    const res = await api<SyncResponse>(`/sync/${spec.name}`, { since: cursor, upserts: batch.map(spec.toWire), deletes });
    const accepted = new Set(res.accepted);

    for (const r of batch) {
      const id = String(r[spec.key]);
      pending.delete(id);
      if (accepted.has(id)) {
        hashes[id] = startHash.get(id)!;
        out.pushed++;
      }
    }
    for (const id of deletes) {
      delete hashes[id];
      if (accepted.has(id)) out.pushed++;
    }

    await db.transaction('rw', table, async () => {
      // Skip anything edited on this device while the sync was running; it goes up next time.
      const untouched = async (id: string) => {
        if (pending.has(id)) return false;
        const cur = await table.get(id);
        return (cur ? spec.hash(cur) : undefined) === startHash.get(id);
      };
      for (const wire of res.rows) {
        const row = spec.fromWire(wire);
        const id = String(row[spec.key]);
        if (!(await untouched(id))) continue;
        await table.put(row);
        hashes[id] = spec.hash(row);
        out.pulled++;
      }
      for (const id of res.deleted) {
        if (!(await untouched(id))) continue;
        if (startHash.has(id)) out.removed++;
        await table.delete(id);
        delete hashes[id];
      }
    });

    cursor = res.rev;
    more = res.more;
    // Save progress after every page so a dropped connection doesn't redo everything.
    await db.syncState.put({ table: spec.name, cursor, hashes });
  } while (queue.length || (more && !pushOnly));
}

export async function syncAll(): Promise<SyncResult> {
  const out: SyncResult = { pushed: 0, pulled: 0, removed: 0 };
  for (const spec of SPECS) {
    // Stop if we were logged out mid-sync, so another user's data never mixes in.
    if (!isSignedIn()) throw new Error('Logged out');
    await syncTable(spec, out);
  }
  return out;
}

/** Forget what was agreed with the server (next sync re-uploads/merges everything). */
export async function resetSyncState(): Promise<void> {
  await db.syncState.clear();
}

/* --------------------------------------------------------------- scheduler */

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSync: number | null;
  lastResult?: SyncResult;
  error?: string;
}

function readLast(): number | null {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || null;
  } catch {
    return null;
  }
}

let status: SyncStatus = { state: 'off', lastSync: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let running: Promise<SyncResult | null> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Run a sync now (or after `delay` ms). Concurrent requests are coalesced. */
export function requestSync(delay = 0): void {
  clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delay);
}

/** Wait for a sync that is already running (if any) to finish. */
export async function waitForSync(): Promise<void> {
  await running?.catch(() => null);
}

export function clearLastSync() {
  try {
    localStorage.removeItem(LAST_KEY);
  } catch {
    /* ignore */
  }
  setStatus({ lastSync: null, lastResult: undefined, error: undefined });
}

/**
 * Upload what changed on this device, every table at once, without downloading the rest.
 * Used when logging out (the device is cleared right after). False when it couldn't.
 */
export async function pushPending(): Promise<boolean> {
  await waitForSync();
  if (!isSignedIn()) return false;
  const out: SyncResult = { pushed: 0, pulled: 0, removed: 0 };
  const job = (async () => {
    setStatus({ state: 'syncing' });
    try {
      await Promise.all(SPECS.map((spec) => syncTable(spec, out, true)));
      setStatus({ state: 'idle', error: undefined });
      return out;
    } catch (e) {
      setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  })();
  // Background syncs wait for this instead of running alongside it.
  running = job;
  try {
    return (await job) !== null;
  } finally {
    running = null;
    again = false;
  }
}

export async function runSync(): Promise<SyncResult | null> {
  if (!isSignedIn()) return null;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setStatus({ state: 'syncing' });
    try {
      const result = await syncAll();
      const now = Date.now();
      try {
        localStorage.setItem(LAST_KEY, String(now));
      } catch {
        /* ignore */
      }
      setStatus({ state: 'idle', lastSync: now, lastResult: result, error: undefined });
      return result;
    } catch (e) {
      setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      running = null;
      if (again) {
        again = false;
        requestSync(500);
      }
    }
  })();
  return running;
}

/** Sync on start, shortly after local edits, when returning to the app, when back online, and every minute. */
export function startAutoSync(): () => void {
  setStatus({ state: isSignedIn() ? 'idle' : 'off', lastSync: readLast() });
  // Start syncing as soon as someone logs in; stop when they log out or the login expires.
  let wasOn = isSignedIn();
  const offAuth = subscribeAuth(() => {
    const on = isSignedIn();
    if (on === wasOn) return;
    wasOn = on;
    setStatus({ state: on ? 'idle' : 'off', error: undefined });
    if (on) requestSync(300);
  });

  const onMutated = (parts: Record<string, unknown>) => {
    // Ignore our own bookkeeping writes.
    if (Object.keys(parts).every((k) => /\/syncState(\/|$)/.test(k))) return;
    if (isSignedIn()) requestSync(2500);
  };
  const onVisible = () => {
    if (isSignedIn()) requestSync(document.visibilityState === 'visible' ? 300 : 0);
  };
  const onOnline = () => requestSync(300);

  Dexie.on('storagemutated', onMutated);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  const interval = setInterval(() => document.visibilityState === 'visible' && requestSync(), 60_000);
  if (isSignedIn()) requestSync(800);

  return () => {
    offAuth();
    Dexie.on('storagemutated').unsubscribe(onMutated);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    clearInterval(interval);
    clearTimeout(timer);
  };
}
