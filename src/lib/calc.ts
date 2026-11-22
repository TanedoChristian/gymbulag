import { addWeeks, startOfWeek } from 'date-fns';
import type { Exercise, MuscleGroup, Session, SessionExercise, WorkSet } from '../types';
import { fromKey, toKey } from './date';

/** Chronological ordering: by date, then by creation time. */
export function compareSessions(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.createdAt - b.createdAt;
}

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort(compareSessions);
}

/** A set that counts toward stats: not a warmup and has reps logged. */
export function isWorkingSet(s: WorkSet): boolean {
  return s.type !== 'warmup' && s.reps != null && s.reps > 0;
}

/** Epley estimated one-rep max. Returns null when reps are out of a meaningful range. */
export function estimate1RM(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  if (reps > 20) return null;
  return weight * (1 + reps / 30);
}

export function setVolume(s: WorkSet): number {
  if (!isWorkingSet(s) || s.weight == null) return 0;
  return s.weight * (s.reps ?? 0);
}

export function exerciseVolume(ex: SessionExercise): number {
  return ex.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function sessionVolume(session: Session): number {
  return session.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
}

export function sessionWorkingSets(session: Session): number {
  return session.exercises.reduce((n, ex) => n + ex.sets.filter(isWorkingSet).length, 0);
}

export function sessionHasContent(session: Session): boolean {
  return session.exercises.some((ex) => ex.sets.some((s) => s.reps != null || s.weight != null));
}

export type PRKind = 'e1rm' | 'weight' | 'reps';

/**
 * Walk all sessions chronologically and mark the sets that beat every
 * previous session for that exercise. The first time an exercise is logged
 * does not count as a PR (there is nothing to beat yet).
 * Only the single best qualifying set per exercise per session is flagged.
 */
export function computePRs(sessions: Session[]): Map<string, PRKind[]> {
  const result = new Map<string, PRKind[]>();
  const best = new Map<string, { e1rm: number; weight: number; reps: number }>();
  const add = (setId: string, kind: PRKind) => {
    const arr = result.get(setId);
    if (arr) {
      if (!arr.includes(kind)) arr.push(kind);
    } else result.set(setId, [kind]);
  };

  for (const session of sortSessions(sessions)) {
    // Aggregate by exercise across the whole session (an exercise can appear twice).
    const perExercise = new Map<string, WorkSet[]>();
    for (const ex of session.exercises) {
      const list = perExercise.get(ex.exerciseId) ?? [];
      list.push(...ex.sets.filter(isWorkingSet));
      perExercise.set(ex.exerciseId, list);
    }
    for (const [exerciseId, sets] of perExercise) {
      if (sets.length === 0) continue;
      let topE1rm: WorkSet | null = null;
      let topE1rmVal = 0;
      let topWeight: WorkSet | null = null;
      let topReps: WorkSet | null = null;
      for (const s of sets) {
        const e = estimate1RM(s.weight, s.reps) ?? 0;
        if (e > topE1rmVal) {
          topE1rmVal = e;
          topE1rm = s;
        }
        if ((s.weight ?? 0) > (topWeight?.weight ?? 0)) topWeight = s;
        if ((s.reps ?? 0) > (topReps?.reps ?? 0)) topReps = s;
      }
      const prev = best.get(exerciseId);
      const sessionBest = {
        e1rm: topE1rmVal,
        weight: topWeight?.weight ?? 0,
        reps: topReps?.reps ?? 0,
      };
      if (prev) {
        const EPS = 1e-6;
        if (topE1rm && sessionBest.e1rm > prev.e1rm + EPS) add(topE1rm.id, 'e1rm');
        if (topWeight && sessionBest.weight > prev.weight + EPS) add(topWeight.id, 'weight');
        // Rep PRs only matter for unweighted movements (pull-ups, push-ups...)
        if (topReps && sessionBest.weight === 0 && prev.weight === 0 && sessionBest.reps > prev.reps) {
          add(topReps.id, 'reps');
        }
        best.set(exerciseId, {
          e1rm: Math.max(prev.e1rm, sessionBest.e1rm),
          weight: Math.max(prev.weight, sessionBest.weight),
          reps: Math.max(prev.reps, sessionBest.reps),
        });
      } else {
        best.set(exerciseId, sessionBest);
      }
    }
  }
  return result;
}

/**
 * The most recent performance of an exercise strictly before `current`
 * (chronologically). Returns the matching session exercise and its date.
 */
export function lastPerformance(
  sessions: Session[],
  exerciseId: string,
  current: Pick<Session, 'id' | 'date' | 'createdAt'>,
): { date: string; exercise: SessionExercise } | null {
  let found: { session: Session; exercise: SessionExercise } | null = null;
  for (const s of sessions) {
    if (s.id === current.id) continue;
    const before = s.date < current.date || (s.date === current.date && s.createdAt < current.createdAt);
    if (!before) continue;
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.reps != null));
    if (!ex) continue;
    if (!found || compareSessions(s, found.session) > 0) found = { session: s, exercise: ex };
  }
  return found ? { date: found.session.date, exercise: found.exercise } : null;
}

export interface HistoryPoint {
  sessionId: string;
  date: string;
  topWeight: number;
  bestE1rm: number;
  volume: number;
  maxReps: number;
  totalReps: number;
  sets: WorkSet[];
}

export function exerciseHistory(sessions: Session[], exerciseId: string): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const s of sortSessions(sessions)) {
    const sets = s.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter(isWorkingSet));
    if (sets.length === 0) continue;
    points.push({
      sessionId: s.id,
      date: s.date,
      topWeight: Math.max(0, ...sets.map((x) => x.weight ?? 0)),
      bestE1rm: Math.max(0, ...sets.map((x) => estimate1RM(x.weight, x.reps) ?? 0)),
      volume: sets.reduce((a, x) => a + setVolume(x), 0),
      maxReps: Math.max(0, ...sets.map((x) => x.reps ?? 0)),
      totalReps: sets.reduce((a, x) => a + (x.reps ?? 0), 0),
      sets,
    });
  }
  return points;
}

export interface ExerciseRecords {
  bestE1rm: { value: number; date: string; set: WorkSet } | null;
  heaviest: { value: number; date: string; set: WorkSet } | null;
  mostReps: { value: number; date: string; set: WorkSet } | null;
  bestVolume: { value: number; date: string } | null;
  sessions: number;
}

export function exerciseRecords(history: HistoryPoint[]): ExerciseRecords {
  const rec: ExerciseRecords = { bestE1rm: null, heaviest: null, mostReps: null, bestVolume: null, sessions: history.length };
  for (const p of history) {
    for (const set of p.sets) {
      const e = estimate1RM(set.weight, set.reps) ?? 0;
      if (e > 0 && e > (rec.bestE1rm?.value ?? 0)) rec.bestE1rm = { value: e, date: p.date, set };
      const w = set.weight ?? 0;
      if (w > 0 && w > (rec.heaviest?.value ?? 0)) rec.heaviest = { value: w, date: p.date, set };
      const r = set.reps ?? 0;
      if (r > (rec.mostReps?.value ?? 0)) rec.mostReps = { value: r, date: p.date, set };
    }
    if (p.volume > 0 && p.volume > (rec.bestVolume?.value ?? 0)) rec.bestVolume = { value: p.volume, date: p.date };
  }
  return rec;
}

/** Consecutive weeks (ending this week or last week) with at least one session. */
export function weeklyStreak(sessions: Session[], weekStartsOn: 0 | 1, today = new Date()): number {
  const weeks = new Set(
    sessions.filter(sessionHasContent).map((s) => toKey(startOfWeek(fromKey(s.date), { weekStartsOn }))),
  );
  let cursor = startOfWeek(today, { weekStartsOn });
  if (!weeks.has(toKey(cursor))) cursor = addWeeks(cursor, -1);
  let streak = 0;
  while (weeks.has(toKey(cursor))) {
    streak++;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

export interface WeekBucket {
  weekStart: string;
  sessions: number;
  volume: number;
  sets: number;
}

export function weeklyBuckets(sessions: Session[], weeks: number, weekStartsOn: 0 | 1, today = new Date()): WeekBucket[] {
  const start = startOfWeek(today, { weekStartsOn });
  const buckets: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const b: WeekBucket = { weekStart: toKey(addWeeks(start, -i)), sessions: 0, volume: 0, sets: 0 };
    buckets.push(b);
    index.set(b.weekStart, b);
  }
  for (const s of sessions) {
    if (!sessionHasContent(s)) continue;
    const b = index.get(toKey(startOfWeek(fromKey(s.date), { weekStartsOn })));
    if (!b) continue;
    b.sessions++;
    b.volume += sessionVolume(s);
    b.sets += sessionWorkingSets(s);
  }
  return buckets;
}

export function muscleSetCounts(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  sinceKey: string,
): { muscle: MuscleGroup; sets: number }[] {
  const counts = new Map<MuscleGroup, number>();
  for (const s of sessions) {
    if (s.date < sinceKey) continue;
    for (const ex of s.exercises) {
      const meta = exercises.get(ex.exerciseId);
      if (!meta) continue;
      const n = ex.sets.filter(isWorkingSet).length;
      if (n) counts.set(meta.muscle, (counts.get(meta.muscle) ?? 0) + n);
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

/** Primary muscle groups trained in a session, most sets first. */
export function sessionMuscles(session: Session, exercises: Map<string, Exercise>): MuscleGroup[] {
  const counts = new Map<MuscleGroup, number>();
  for (const ex of session.exercises) {
    const m = exercises.get(ex.exerciseId)?.muscle;
    if (!m) continue;
    counts.set(m, (counts.get(m) ?? 0) + Math.max(1, ex.sets.length));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** "80×8, 80×8, 82.5×6" — compact human summary. Weight formatter is injected for unit handling. */
export function summarizeSets(sets: WorkSet[], fmt: (kg: number) => string): string {
  return sets
    .filter((s) => s.reps != null || s.weight != null)
    .map((s) => {
      const reps = s.reps ?? '?';
      return s.weight != null && s.weight > 0 ? `${fmt(s.weight)}×${reps}` : `${reps} reps`;
    })
    .join(', ');
}

/* ------------------------------ Rep-range PRs ----------------------------- */

export const REP_RANGES = [
  { key: 'strength', label: 'Strength', range: '1–5', min: 1, max: 5 },
  { key: 'hypertrophy', label: 'Hypertrophy', range: '6–12', min: 6, max: 12 },
  { key: 'endurance', label: 'Endurance', range: '13+', min: 13, max: Infinity },
] as const;
export type RepRangeKey = (typeof REP_RANGES)[number]['key'];

export interface BestSet {
  weight: number;
  reps: number;
  date: string;
  sessionId: string;
}

/** Heavier wins; on equal weight more reps wins; on a full tie the first time it was done is kept. */
function better(a: BestSet | null, w: number, r: number): boolean {
  if (!a) return true;
  if (w !== a.weight) return w > a.weight;
  return r > a.reps;
}

/** Best set within each rep range (Strength 1–5, Hypertrophy 6–12, Endurance 13+). */
export function repRangeBests(history: HistoryPoint[]): Record<RepRangeKey, BestSet | null> {
  const out: Record<RepRangeKey, BestSet | null> = { strength: null, hypertrophy: null, endurance: null };
  for (const p of history) {
    for (const s of p.sets) {
      const reps = s.reps ?? 0;
      const w = s.weight ?? 0;
      const range = REP_RANGES.find((r) => reps >= r.min && reps <= r.max);
      if (!range) continue;
      if (better(out[range.key], w, reps)) out[range.key] = { weight: w, reps, date: p.date, sessionId: p.sessionId };
    }
  }
  return out;
}

export const REP_MAX_TARGETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15] as const;

/**
 * Classic rep-max table: the heaviest weight lifted for at least N reps.
 * (A set of 100×6 also counts as your 5RM, 4RM, … if nothing heavier was done for those.)
 */
export function repMaxes(history: HistoryPoint[]): { target: number; best: BestSet | null }[] {
  return REP_MAX_TARGETS.map((target) => {
    let best: BestSet | null = null;
    for (const p of history) {
      for (const s of p.sets) {
        const reps = s.reps ?? 0;
        const w = s.weight ?? 0;
        if (reps < target || w <= 0) continue;
        if (better(best, w, reps)) best = { weight: w, reps, date: p.date, sessionId: p.sessionId };
      }
    }
    return { target, best };
  });
}

/** Inverse Epley: weight you should manage for `reps` given an estimated 1RM. */
export function weightForReps(e1rm: number, reps: number): number {
  return reps <= 1 ? e1rm : e1rm / (1 + reps / 30);
}

/* ------------------------------ Session title ----------------------------- */

const MUSCLE_TITLES: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Glutes',
  calves: 'Calves',
  'full body': 'Full body',
  cardio: 'Cardio',
};

/** The session's own name, or one derived from what was trained ("Chest & Triceps"). */
export function sessionTitle(session: Session, exercises: Map<string, Exercise>): string {
  if (session.name.trim()) return session.name.trim();
  const names = [...new Set(sessionMuscles(session, exercises).map((m) => MUSCLE_TITLES[m] ?? m))].slice(0, 2);
  return names.length ? names.join(' & ') : 'Workout';
}
