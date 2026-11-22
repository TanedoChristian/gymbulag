import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db';
import { sortSessions } from '../lib/calc';
import { DEFAULT_SETTINGS, type Activity, type Exercise, type Session, type Settings, type Template } from '../types';

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get('app'), []);
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(row?.value ?? {}) }), [row]);
}

/** All sessions, chronologically sorted. `undefined` while loading. */
export function useAllSessions(): Session[] | undefined {
  const rows = useLiveQuery(() => db.sessions.toArray(), []);
  return useMemo(() => (rows ? sortSessions(rows) : undefined), [rows]);
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
}

export function useExerciseMap(): Map<string, Exercise> {
  const list = useExercises();
  return useMemo(() => new Map((list ?? []).map((e) => [e.id, e])), [list]);
}

export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.orderBy('name').toArray(), []);
}

/** All walks and runs, oldest first. `undefined` while loading. */
export function useAllActivities(): Activity[] | undefined {
  const rows = useLiveQuery(() => db.activities.toArray(), []);
  return useMemo(() => rows?.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt), [rows]);
}

export interface BodyWeightPoint {
  date: string;
  kg: number;
  /** 'weighin' = logged on the day page; 'session' = from a gym session's details */
  source: 'weighin' | 'session';
}

/**
 * Every day with a known body weight, oldest first. A day-page weigh-in wins over a session's
 * bodyweight; with several sessions on one day, the last one counts. `undefined` while loading.
 */
export function useBodyWeights(): BodyWeightPoint[] | undefined {
  const weights = useLiveQuery(() => db.weights.toArray(), []);
  const sessions = useAllSessions();
  return useMemo(() => {
    if (!weights || !sessions) return undefined;
    const byDate = new Map<string, BodyWeightPoint>();
    for (const s of sessions) if (s.bodyweight != null && s.bodyweight > 0) byDate.set(s.date, { date: s.date, kg: s.bodyweight, source: 'session' });
    for (const w of weights) byDate.set(w.date, { date: w.date, kg: w.kg, source: 'weighin' });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [weights, sessions]);
}

/** Most recent known body weight in kg, or null. */
export function useLatestBodyWeight(): number | null {
  const all = useBodyWeights();
  return all?.length ? all[all.length - 1].kg : null;
}
