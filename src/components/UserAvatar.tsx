import { useEffect, useState } from 'react';
import { avatarSrc } from '../lib/profile';

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const;

export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** A user's profile picture, or their initials when there isn't one (or it fails to load). */
export function UserAvatar({ name, avatarKey, src, size = 'sm', className = '' }: { name: string; avatarKey?: string | null; src?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const url = src ?? avatarSrc(avatarKey);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZES[size]} ${className}`;
  if (url && !broken) return <img src={url} alt="" className={`${base} bg-steel/10 object-cover`} onError={() => setBroken(true)} loading="lazy" decoding="async" />;
  return (
    <span className={`${base} bg-rack font-display font-bold text-volt-500`} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
