import { differenceInMinutes, format, parse, parseISO } from 'date-fns';

export function toKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function fromKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function isValidKey(key: string | undefined): key is string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseISO(key);
  return !Number.isNaN(d.getTime()) && toKey(d) === key;
}

export function nowHHmm(): string {
  return format(new Date(), 'HH:mm');
}

/** Duration between two HH:mm strings in minutes (handles crossing midnight). */
export function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ref = new Date(2000, 0, 1);
  const a = parse(start, 'HH:mm', ref);
  const b = parse(end, 'HH:mm', ref);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  let m = differenceInMinutes(b, a);
  if (m < 0) m += 24 * 60;
  return m;
}

export function formatDuration(mins: number | null): string {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}
