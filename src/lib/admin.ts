/* Admin panel API: overview, accounts and login activity. Community management is in community.ts. */
import { adminApi } from './adminAuth';
import type { AccountStatus } from './community';
import type { ProfileFields } from './profile';

export type Role = 'user' | 'admin';

export interface AdminUser extends ProfileFields {
  id: number;
  email: string;
  name: string;
  /** yyyy-MM-dd */
  birthDate: string;
  role: Role;
  /** Where admin rights come from: ADMIN_EMAILS on the server ('env', can't be removed here) or the stored role. */
  adminSource: 'env' | 'role' | null;
  status: AccountStatus;
  createdAt: number;
  updatedAt: number | null;
  statusChangedAt: number | null;
  lastSeen: number | null;
  /** Communities joined. */
  communities: number;
  /** Communities they're a gym owner of. */
  owned: number;
  /** Signed-in devices. */
  devices: number;
  avatarKey: string | null;
}

export interface LoginEvent {
  id: number;
  userId: number | null;
  name: string | null;
  email: string;
  success: boolean;
  reason: string;
  portal: 'app' | 'admin';
  ip: string;
  userAgent: string;
  at: number;
}

export interface Device {
  id: string;
  device: string;
  admin: boolean;
  createdAt: number;
  lastUsedAt: number;
}

export interface UserDetail {
  user: AdminUser;
  devices: Device[];
  logins: LoginEvent[];
  memberships: { id: number; name: string; active: boolean; status: 'active' | 'blocked'; joinedAt: number }[];
  owned: { id: number; name: string; active: boolean }[];
  workouts: { total: number; last: string | null };
}

export interface Overview {
  users: { total: number; active: number; inactive: number; blocked: number; admins: number; owners: number; newThisWeek: number; activeToday: number };
  communities: { total: number; active: number; members: number };
  logins: { today: number; failedToday: number; days: { date: string; ok: number; failed: number }[] };
  recentUsers: AdminUser[];
  recentFailures: LoginEvent[];
}

export const getOverview = () => adminApi<Overview>('/admin/overview');
export const listUsers = () => adminApi<{ users: AdminUser[] }>('/admin/users').then((r) => r.users);
export const getUser = (id: number) => adminApi<UserDetail>(`/admin/users/${id}`);
export const updateUser = (userId: number, patch: { name?: string; email?: string; birthDate?: string } & Partial<ProfileFields>) =>
  adminApi<{ user: AdminUser }>('/admin/users/update', { userId, ...patch }).then((r) => r.user);
export const setUserAvatar = (userId: number, image: string | null) => adminApi<{ user: AdminUser }>('/admin/users/avatar', { userId, image }).then((r) => r.user);
export const setRole = (userId: number, role: Role) => adminApi<{ user: AdminUser }>('/admin/users/role', { userId, role }).then((r) => r.user);
export const setStatus = (userId: number, status: AccountStatus) => adminApi<{ user: AdminUser }>('/admin/users/status', { userId, status }).then((r) => r.user);
export const resetPassword = (userId: number, password: string) => adminApi<{ ok: true; signedOut: number }>('/admin/users/password', { userId, password });
export const signOutUser = (userId: number, deviceId?: string) => adminApi<{ ok: true; signedOut: number }>('/admin/users/signout', { userId, deviceId });

export interface LoginQuery {
  q?: string;
  result?: 'success' | 'failed' | '';
  portal?: 'app' | 'admin' | '';
  userId?: number;
  offset?: number;
  limit?: number;
}

export function listLogins(query: LoginQuery) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  return adminApi<{ total: number; offset: number; limit: number; events: LoginEvent[] }>(`/admin/logins?${params}`);
}

/* ---------------------------------------------------------------- labels */

export const STATUS_LABEL: Record<AccountStatus, string> = { active: 'Active', inactive: 'Deactivated', blocked: 'Blocked' };

export const REASON_LABEL: Record<string, string> = {
  ok: 'Signed in',
  signup: 'Signed up',
  from_app: 'Opened from app',
  wrong_password: 'Wrong password',
  unknown_email: 'Unknown email',
  blocked: 'Account blocked',
  inactive: 'Account deactivated',
  not_admin: 'Not an admin',
  rate_limited: 'Too many attempts',
};

/** "Chrome on Android" from a user-agent string. */
export function describeDevice(ua: string): string {
  const s = ua.replace(/^admin · /, '');
  if (!s) return 'Unknown device';
  if (/curl|node|undici|python|postman|insomnia/i.test(s) && !/Mozilla/.test(s)) return 'API client';
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /OPR\/|Opera/.test(s)
      ? 'Opera'
      : /SamsungBrowser/.test(s)
        ? 'Samsung Internet'
        : /Firefox\//.test(s)
          ? 'Firefox'
          : /Chrome\//.test(s) || /CriOS/.test(s)
            ? 'Chrome'
            : /Safari\//.test(s)
              ? 'Safari'
              : 'Browser';
  const os = /Android/.test(s)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(s)
      ? 'iOS'
      : /Windows/.test(s)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(s)
          ? 'macOS'
          : /CrOS/.test(s)
            ? 'ChromeOS'
            : /Linux/.test(s)
              ? 'Linux'
              : '';
  return os ? `${browser} on ${os}` : browser;
}
