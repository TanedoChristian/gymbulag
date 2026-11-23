/* Account flows: sign up, log in, log out, profile. The data on this device always belongs to one account. */
import { useSyncExternalStore } from 'react';
import { db } from '../db';
import { wipeAllData } from './repo';
import { api, getAuth, setAuth, subscribeAuth, type AuthState, type User } from './api';
import { clearLastSync, resetSyncState, runSync, waitForSync } from './sync';

export type { User } from './api';
import type { ProfileFields } from './profile';

const OWNER_KEY = 'gymbulag:owner';

/** The logged-in account (re-renders on login, logout, profile changes and expiry). */
export function useAuth(): AuthState | null {
  return useSyncExternalStore(subscribeAuth, getAuth);
}

/** Which account the data on this device belongs to (null = nobody yet, e.g. logged before accounts existed). */
export function deviceOwner(): number | null {
  try {
    const v = Number(localStorage.getItem(OWNER_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function setDeviceOwner(id: number | null) {
  try {
    if (id == null) localStorage.removeItem(OWNER_KEY);
    else localStorage.setItem(OWNER_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export interface LocalSummary {
  sessions: number;
  activities: number;
  foodlog: number;
  photos: number;
  total: number;
}

/** What's on this device that isn't a built-in exercise or template. */
export async function localSummary(): Promise<LocalSummary> {
  const [sessions, activities, foodlog, photos, foods, customExercises, weights] = await Promise.all([
    db.sessions.count(),
    db.activities.count(),
    db.foodlog.count(),
    db.photos.count(),
    db.foods.count(),
    db.exercises.filter((e) => !!e.custom).count(),
    db.weights.count(),
  ]);
  return { sessions, activities, foodlog, photos, total: sessions + activities + foodlog + photos + foods + customExercises + weights };
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  birthDate: string;
  signupCode?: string;
}

export function signUp(data: SignUpData): Promise<AuthResult> {
  return api<AuthResult>('/auth/register', data, { token: null });
}

export function logIn(email: string, password: string): Promise<AuthResult> {
  return api<AuthResult>('/auth/login', { email, password }, { token: null });
}

/**
 * What to do with the data already on this device for this account:
 *  - 'resume':  it is already this account's data
 *  - 'ask':     it was logged without an account, so ask whether to keep it
 *  - 'replace': it belongs to someone else (or there is none), so it is cleared
 */
export async function deviceDataPlan(user: User): Promise<{ plan: 'resume' | 'ask' | 'replace'; summary: LocalSummary }> {
  const owner = deviceOwner();
  const summary = await localSummary();
  if (owner === user.id) return { plan: 'resume', summary };
  if (owner == null && summary.total > 0) return { plan: 'ask', summary };
  return { plan: 'replace', summary };
}

/** Finish logging in. keepLocal: upload what's on this device into the account instead of clearing it. */
export async function completeLogin(res: AuthResult, keepLocal: boolean): Promise<void> {
  const owner = deviceOwner();
  if (owner !== res.user.id) {
    await waitForSync();
    if (keepLocal) await resetSyncState();
    else await wipeAllData();
    clearLastSync();
    setDeviceOwner(res.user.id);
  }
  setAuth({ token: res.token, user: res.user } satisfies AuthState);
}

/**
 * Log out: upload pending changes, end the session on the server, and clear this device.
 * Returns false (and does nothing) if changes couldn't be uploaded and `force` isn't set.
 */
export async function logOut({ force = false } = {}): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return true;
  if (!auth.expired && !force) {
    const r = await runSync();
    if (!r) return false;
  }
  await api('/auth/logout', {}).catch(() => {});
  setAuth(null);
  await waitForSync();
  await wipeAllData();
  clearLastSync();
  setDeviceOwner(null);
  return true;
}

export async function updateProfile(patch: { name?: string; birthDate?: string } & Partial<ProfileFields>): Promise<User> {
  const { user } = await api<{ user: User }>('/auth/profile', patch);
  const cur = getAuth();
  if (cur) setAuth({ ...cur, user });
  return user;
}

/** Set (data: URL) or remove (null) your profile picture. */
export async function setMyAvatar(image: string | null): Promise<User> {
  const { user } = await api<{ user: User }>('/auth/avatar', { image });
  const cur = getAuth();
  if (cur) setAuth({ ...cur, user });
  return user;
}

export function changePassword(current: string, password: string): Promise<{ ok: true; otherDevicesLoggedOut: number }> {
  return api('/auth/password', { current, password });
}

/** Age in whole years on `today`. */
export function ageFromBirthDate(birthDate: string, today = new Date()): number | null {
  const m = birthDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age;
}
