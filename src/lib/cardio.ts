import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { fromKey, toKey } from './date';
import { trimNumber } from './units';
import type { Activity, ActivityKind } from '../types';

export const KIND_LABEL: Record<ActivityKind, string> = { walk: 'Walk', run: 'Run' };
export const KIND_COLOR: Record<ActivityKind, string> = { walk: '#10b981', run: '#f97316' };

/** True once any of steps / distance / time has been filled in. */
export function activityHasContent(a: Pick<Activity, 'steps' | 'distance' | 'duration'>): boolean {
  return !!(a.steps || a.distance || a.duration);
}

/** Minutes per km, or null when distance or time is missing. */
export function activityPace(a: Pick<Activity, 'distance' | 'duration'>): number | null {
  if (!a.distance || !a.duration || a.distance <= 0 || a.duration <= 0) return null;
  return a.duration / a.distance;
}

/** 6.2 -> "6:12 /km" */
export function formatPace(minPerKm: number | null): string {
  if (minPerKm == null || !Number.isFinite(minPerKm)) return '—';
  let m = Math.floor(minPerKm);
  let s = Math.round((minPerKm - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

const stepsFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
export function formatSteps(n: number): string {
  return n >= 100_000 ? `${trimNumber(n / 1000, 0)}k` : stepsFmt.format(n);
}

export function formatKm(km: number): string {
  return trimNumber(km, km >= 100 ? 0 : km >= 10 ? 1 : 2);
}

/** One-line summary: "5.2 km · 32 min · 7,400 steps" */
export function describeActivity(a: Activity): string {
  const parts: string[] = [];
  if (a.distance) parts.push(`${formatKm(a.distance)} km`);
  if (a.duration) parts.push(`${trimNumber(a.duration, 0)} min`);
  if (a.steps) parts.push(`${formatSteps(a.steps)} steps`);
  return parts.join(' · ');
}

export interface DayTotal {
  date: string;
  steps: number;
  distance: number;
  duration: number;
  walkKm: number;
  runKm: number;
  count: number;
}

const emptyDay = (date: string): DayTotal => ({ date, steps: 0, distance: 0, duration: 0, walkKm: 0, runKm: 0, count: 0 });

function add(t: { steps: number; distance: number; duration: number; walkKm: number; runKm: number; count: number }, a: Activity) {
  t.steps += a.steps ?? 0;
  t.distance += a.distance ?? 0;
  t.duration += a.duration ?? 0;
  if (a.kind === 'run') t.runKm += a.distance ?? 0;
  else t.walkKm += a.distance ?? 0;
  t.count++;
}

/** Totals per day (several walks/runs on a day are added together). */
export function dayTotals(activities: Activity[]): Map<string, DayTotal> {
  const out = new Map<string, DayTotal>();
  for (const a of activities) {
    if (!activityHasContent(a)) continue;
    const t = out.get(a.date) ?? emptyDay(a.date);
    add(t, a);
    out.set(a.date, t);
  }
  return out;
}

/** The last `days` days ending today, including days with nothing logged. */
export function dailySeries(activities: Activity[], days: number, today = new Date()): DayTotal[] {
  const totals = dayTotals(activities);
  const out: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    out.push(totals.get(key) ?? emptyDay(key));
  }
  return out;
}

export interface CardioWeek extends Omit<DayTotal, 'date'> {
  weekStart: string;
  /** Days in the week with at least one walk or run */
  activeDays: number;
}

export function weeklyCardio(activities: Activity[], weeks: number, weekStartsOn: 0 | 1, today = new Date()): CardioWeek[] {
  const start = startOfWeek(today, { weekStartsOn });
  const buckets: CardioWeek[] = [];
  const index = new Map<string, CardioWeek>();
  const days = new Map<string, Set<string>>();
  for (let i = weeks - 1; i >= 0; i--) {
    const b: CardioWeek = { weekStart: toKey(addWeeks(start, -i)), steps: 0, distance: 0, duration: 0, walkKm: 0, runKm: 0, count: 0, activeDays: 0 };
    buckets.push(b);
    index.set(b.weekStart, b);
    days.set(b.weekStart, new Set());
  }
  for (const a of activities) {
    if (!activityHasContent(a)) continue;
    const ws = toKey(startOfWeek(fromKey(a.date), { weekStartsOn }));
    const b = index.get(ws);
    if (!b) continue;
    add(b, a);
    days.get(ws)!.add(a.date);
  }
  for (const b of buckets) b.activeDays = days.get(b.weekStart)!.size;
  return buckets;
}

export interface CardioRecord<T = number> {
  value: T;
  date: string;
  id?: string;
}

export interface CardioRecords {
  longestRun: CardioRecord | null;
  longestWalk: CardioRecord | null;
  /** Fastest pace (min/km) on a run of at least 1 km */
  fastestRun: CardioRecord | null;
  mostStepsDay: CardioRecord | null;
  bestWeekKm: CardioRecord | null;
}

export function cardioRecords(activities: Activity[], weekStartsOn: 0 | 1): CardioRecords {
  const out: CardioRecords = { longestRun: null, longestWalk: null, fastestRun: null, mostStepsDay: null, bestWeekKm: null };
  const better = (cur: CardioRecord | null, value: number, higher = true) => !cur || (higher ? value > cur.value : value < cur.value);
  for (const a of activities) {
    if (a.distance && a.distance > 0) {
      if (a.kind === 'run' && better(out.longestRun, a.distance)) out.longestRun = { value: a.distance, date: a.date, id: a.id };
      if (a.kind === 'walk' && better(out.longestWalk, a.distance)) out.longestWalk = { value: a.distance, date: a.date, id: a.id };
    }
    const pace = activityPace(a);
    if (a.kind === 'run' && pace != null && (a.distance ?? 0) >= 1 && better(out.fastestRun, pace, false)) out.fastestRun = { value: pace, date: a.date, id: a.id };
  }
  for (const d of dayTotals(activities).values()) if (d.steps > 0 && better(out.mostStepsDay, d.steps)) out.mostStepsDay = { value: d.steps, date: d.date };
  const weeks = new Map<string, number>();
  for (const a of activities) {
    if (!a.distance) continue;
    const ws = toKey(startOfWeek(fromKey(a.date), { weekStartsOn }));
    weeks.set(ws, (weeks.get(ws) ?? 0) + a.distance);
  }
  for (const [ws, km] of weeks) if (better(out.bestWeekKm, km)) out.bestWeekKm = { value: km, date: ws };
  return out;
}

/** Consecutive days (ending today, or yesterday if today is still empty) with a walk or run. */
export function cardioDayStreak(activities: Activity[], today = new Date()): number {
  const days = dayTotals(activities);
  let d = today;
  if (!days.has(toKey(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(toKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
