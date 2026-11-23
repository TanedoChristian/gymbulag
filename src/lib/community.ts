/* Gym communities: joining by QR, the admin panel and gym-owner dashboards. */
import QRCode from 'qrcode';
import { api } from './api';
import { adminApi } from './adminAuth';

export type AccountStatus = 'active' | 'inactive' | 'blocked';
export type MemberStatus = 'active' | 'blocked';

export interface CommunityOwner {
  id: number;
  name: string;
  email: string;
}

export interface Community {
  id: number;
  name: string;
  location: string;
  joinCode: string;
  /** Accepting new members by QR. */
  active: boolean;
  createdAt: number;
  members: number;
  blocked: number;
  joinedThisWeek: number;
  owners: CommunityOwner[];
}

export interface Member {
  userId: number;
  name: string;
  email: string;
  avatarKey: string | null;
  status: MemberStatus;
  accountStatus: AccountStatus;
  joinedAt: number;
  blockedAt: number | null;
  lastSeen: number | null;
  /** Workouts logged in the last 30 days. */
  sessions30: number;
  /** yyyy-MM-dd */
  lastWorkout: string | null;
}

export interface MyCommunity {
  id: number;
  name: string;
  location: string;
  /** False when an admin deactivated the community. */
  active: boolean;
  joinedAt: number;
}

/* --------------------------------------------------------------- QR codes */

/** The address a QR code opens. Set VITE_PUBLIC_URL when the admin panel runs on a different address than members use (e.g. localhost). */
export function joinUrl(code: string): string {
  const base = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin).replace(/\/+$/, '');
  return `${base}/join/${encodeURIComponent(code)}`;
}

export function qrDataUrl(text: string, width = 640): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0a0c0e', light: '#ffffff' } });
}

/* ------------------------------------------------------------------ members */

export const previewJoin = (code: string) =>
  api<{ community: { id: number; name: string; location: string; active: boolean }; membership: MemberStatus | null }>(`/communities/join/${encodeURIComponent(code)}`);
export const joinCommunity = (code: string) => api<{ community: { id: number; name: string; location: string }; alreadyMember: boolean }>('/communities/join', { code });
export const myCommunities = () => api<{ communities: MyCommunity[] }>('/communities/mine').then((r) => r.communities);
export const leaveCommunity = (id: number) => api('/communities/leave', { id });

/* --------------------------------------------------------------- gym owners */

export const ownedCommunities = () => api<{ communities: Community[] }>('/owner/communities').then((r) => r.communities);
/** `asAdmin`: called from the admin panel, so it uses the admin sign-in instead of the app's. */
export const communityMembers = (id: number, asAdmin = false) =>
  (asAdmin ? adminApi : api)<{ community: Community; members: Member[] }>(`/communities/${id}/members`);
export const setMemberStatus = (communityId: number, userId: number, status: MemberStatus, asAdmin = false) =>
  (asAdmin ? adminApi : api)(`/communities/${communityId}/members/status`, { userId, status });

/* -------------------------------------------------------------------- admin */

export const adminCommunities = () => adminApi<{ communities: Community[] }>('/admin/communities').then((r) => r.communities);
export const createCommunity = (name: string, location: string) => adminApi<{ community: Community }>('/admin/communities', { name, location }).then((r) => r.community);
export const updateCommunity = (id: number, patch: { name?: string; location?: string; active?: boolean; regenerateCode?: boolean }) =>
  adminApi<{ community: Community }>('/admin/communities/update', { id, ...patch }).then((r) => r.community);
export const deleteCommunity = (id: number) => adminApi('/admin/communities/delete', { id });
export const addOwner = (communityId: number, email: string) => adminApi<{ community: Community }>('/admin/communities/owners/add', { communityId, email }).then((r) => r.community);
export const removeOwner = (communityId: number, userId: number) => adminApi<{ community: Community }>('/admin/communities/owners/remove', { communityId, userId }).then((r) => r.community);
