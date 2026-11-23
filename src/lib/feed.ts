/* Community feed: posts, likes, comments, members, and (ready, not yet in the UI) post pictures. */
import { api, apiBase } from './api';
import type { Visibility } from './community';

export interface Author {
  id: number;
  name: string;
  avatarKey: string | null;
  /** Gym owner of this community. */
  isOwner: boolean;
}

export interface PostMedia {
  key: string;
  width: number | null;
  height: number | null;
}

export interface Post {
  id: number;
  communityId: number;
  author: Author;
  body: string;
  pinned: boolean;
  createdAt: number;
  editedAt: number | null;
  likes: number;
  liked: boolean;
  comments: number;
  media: PostMedia[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface Comment {
  id: number;
  postId: number;
  author: Author;
  body: string;
  createdAt: number;
  canDelete: boolean;
}

export interface CommunityInfo {
  id: number;
  name: string;
  location: string;
  visibility: Visibility;
  active: boolean;
  members: number;
  coverKey: string | null;
}

export interface FeedAccess {
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  /** Can delete anyone's posts and comments, and pin posts. */
  canModerate: boolean;
  /** False while the community is deactivated (read-only). */
  canPost: boolean;
}

export interface FeedPage {
  community: CommunityInfo;
  me: FeedAccess;
  /** Only on the first page. */
  pinned: Post[];
  posts: Post[];
  /** Pass as `before` to load older posts; null when there are no more. */
  nextBefore: number | null;
}

export interface Person {
  id: number;
  name: string;
  avatarKey: string | null;
  isOwner: boolean;
  joinedAt: number;
}

export const POST_MAX = 2000;
export const COMMENT_MAX = 1000;
export const MAX_POST_IMAGES = 4;

export const getFeed = (communityId: number, before?: number | null) => api<FeedPage>(`/communities/${communityId}/feed${before ? `?before=${before}` : ''}`);
export const createPost = (communityId: number, body: string, mediaIds: number[] = []) => api<{ post: Post }>(`/communities/${communityId}/posts`, { body, mediaIds }).then((r) => r.post);
export const editPost = (postId: number, body: string) => api<{ post: Post }>(`/posts/${postId}/update`, { body }).then((r) => r.post);
export const deletePost = (postId: number) => api(`/posts/${postId}/delete`, {});
export const pinPost = (postId: number, pinned: boolean) => api<{ post: Post }>(`/posts/${postId}/pin`, { pinned }).then((r) => r.post);
export const likePost = (postId: number, liked: boolean) => api<{ liked: boolean; likes: number }>(`/posts/${postId}/like`, { liked });
export const getComments = (postId: number) => api<{ comments: Comment[] }>(`/posts/${postId}/comments`).then((r) => r.comments);
export const addComment = (postId: number, body: string) => api<{ comment: Comment }>(`/posts/${postId}/comments`, { body }).then((r) => r.comment);
export const deleteComment = (commentId: number) => api(`/comments/${commentId}/delete`, {});
export const getPeople = (communityId: number) => api<{ community: CommunityInfo; people: Person[] }>(`/communities/${communityId}/people`);

/* -------------------------------------------------------------- pictures */

export const mediaSrc = (key: string) => `${apiBase()}/community-media/${encodeURIComponent(key)}`;

/** Shrink a photo for a post (longest side `max` px, JPEG). Keeps the aspect ratio. */
export async function preparePostImage(file: File, max = 1600): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  if (file.size > 30 * 1024 * 1024) throw new Error('That image is too large');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image. Try a JPEG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Your browser can't resize images");
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload one picture for a post you're writing; pass the returned ids to createPost.
 * One request per picture keeps each well under hosting request-size limits.
 */
export async function uploadPostImage(communityId: number, file: File): Promise<PostMedia & { id: number }> {
  const img = await preparePostImage(file);
  const { media } = await api<{ media: PostMedia & { id: number } }>(`/communities/${communityId}/media`, { image: img.dataUrl, width: img.width, height: img.height });
  return media;
}
