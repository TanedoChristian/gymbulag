/* Talking to the Gymbulag server: where it is, who is logged in, and one fetch helper. */
import type { ProfileFields } from './profile';

export interface User extends Partial<ProfileFields> {
  id: number;
  email: string;
  name: string;
  /** yyyy-MM-dd */
  birthDate: string;
  createdAt: number;
  /** 'admin' runs the admin panel. Missing on logins saved before roles existed. */
  role?: 'user' | 'admin';
  /** Was given access to at least one gym community's dashboard. */
  isOwner?: boolean;
  /** Profile picture id (see avatarSrc); null = no picture. */
  avatarKey?: string | null;
}

export interface AuthState {
  token: string;
  user: User;
  /** The server rejected the token; data stays on the device until the same user logs in again. */
  expired?: boolean;
}

const SERVER_KEY = 'gymbulag:sync';
const AUTH_KEY = 'gymbulag:auth';

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

/* ---------------------------------------------------------------- server */

/** Server address, e.g. http://192.168.1.20:8787. Empty = same address as the app. */
export function getServerUrl(): string {
  return read<{ url?: string }>(SERVER_KEY)?.url ?? '';
}

export function setServerUrl(url: string) {
  write(SERVER_KEY, { ...(read<object>(SERVER_KEY) ?? {}), url: url.trim() });
}

export function apiBase(url = getServerUrl()): string {
  return `${url.trim().replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
}

/* ------------------------------------------------------------------ auth */

let auth: AuthState | null = read<AuthState>(AUTH_KEY);
const listeners = new Set<() => void>();

export function getAuth(): AuthState | null {
  return auth;
}

export function setAuth(next: AuthState | null) {
  auth = next;
  write(AUTH_KEY, next);
  listeners.forEach((l) => l());
}

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Logged in with a token the server still accepts (as far as we know). */
export function isSignedIn(): boolean {
  return !!auth && !auth.expired;
}

/* ------------------------------------------------------------- transport */

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** GET when `body` is undefined, otherwise POST JSON. Sends the login token when there is one. */
export async function api<T>(path: string, body?: unknown, opts: { token?: string | null; base?: string } = {}): Promise<T> {
  const token = opts.token === undefined ? auth?.token : opts.token;
  const base = opts.base ?? apiBase();
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(navigator.onLine === false ? 'You are offline' : `Can't reach the Gymbulag server at ${base}`);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && auth && token === auth.token) setAuth({ ...auth, expired: true });
  if (!res.ok) throw new ApiError(data?.error ?? (res.status === 404 || res.status === 502 || res.status === 504 ? "The Gymbulag server isn't running" : `Server error (${res.status})`), res.status);
  if (data == null) throw new ApiError("That address isn't a Gymbulag server");
  return data as T;
}
