/* The admin panel's own sign-in. Kept apart from the app's login so an admin session never touches the workout data on this device. */
import { useSyncExternalStore } from 'react';
import { api, ApiError, type User } from './api';

export interface AdminSession {
  token: string;
  user: User;
}

const KEY = 'gymbulag:admin-auth';
const listeners = new Set<() => void>();

function read(): AdminSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as AdminSession | null;
  } catch {
    return null;
  }
}

let session: AdminSession | null = read();

function setSession(next: AdminSession | null) {
  session = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the session lasts until the page closes */
  }
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useAdminSession(): AdminSession | null {
  return useSyncExternalStore(subscribe, () => session);
}

export function adminToken(): string | null {
  return session?.token ?? null;
}

/** An API call with the admin token. A rejected token (expired, blocked, no longer admin) signs the panel out. */
export async function adminApi<T>(path: string, body?: unknown): Promise<T> {
  const token = session?.token ?? null;
  if (!token) throw new ApiError('Please sign in', 401);
  try {
    return await api<T>(path, body, { token });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403) && session?.token === token) {
      if (e.status === 401 || /admin/i.test(e.message)) setSession(null);
    }
    throw e;
  }
}

export async function adminLogIn(email: string, password: string): Promise<void> {
  setSession(await api<AdminSession>('/admin/login', { email, password }, { token: null }));
}

export async function adminLogOut(): Promise<void> {
  const token = session?.token;
  setSession(null);
  if (token) await api('/auth/logout', {}, { token }).catch(() => {});
}
