/* Profile details and pictures shared by the app's Settings and the admin panel. */
import { apiBase } from './api';

export type Gender = '' | 'male' | 'female' | 'other' | 'prefer_not';
export type FitnessGoal = '' | 'lose_fat' | 'build_muscle' | 'get_stronger' | 'endurance' | 'general_fitness';
export type Experience = '' | 'beginner' | 'intermediate' | 'advanced';

/** The optional profile fields every user has (empty string = not set). */
export interface ProfileFields {
  phone: string;
  gender: Gender;
  city: string;
  bio: string;
  fitnessGoal: FitnessGoal;
  experience: Experience;
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'build_muscle', label: 'Build muscle' },
  { value: 'get_stronger', label: 'Get stronger' },
  { value: 'endurance', label: 'Improve endurance' },
  { value: 'general_fitness', label: 'General fitness' },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'beginner', label: 'Beginner (under 1 year)' },
  { value: 'intermediate', label: 'Intermediate (1–3 years)' },
  { value: 'advanced', label: 'Advanced (3+ years)' },
];

export const labelOf = <T extends string>(options: { value: T; label: string }[], v: T | undefined | null) => options.find((o) => o.value === v)?.label ?? '';

export const BIO_MAX = 300;

/** The picture's address, or null when there is none. */
export function avatarSrc(key: string | null | undefined): string | null {
  return key ? `${apiBase()}/avatars/${encodeURIComponent(key)}` : null;
}

/**
 * Turn a chosen photo into a small square JPEG data URL (centre crop), ready to upload.
 * Big phone photos become ~20–40 KB.
 */
export async function prepareAvatar(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image. Try a JPEG or PNG."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Your browser can't resize images");
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
