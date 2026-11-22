import { describe, expect, it } from 'vitest';
import {
  computePRs,
  estimate1RM,
  exerciseHistory,
  exerciseRecords,
  lastPerformance,
  muscleSetCounts,
  sessionVolume,
  sessionWorkingSets,
  summarizeSets,
  weeklyBuckets,
  weeklyStreak,
} from './calc';
import type { Exercise, Session, WorkSet } from '../types';

let n = 0;
const set = (weight: number | null, reps: number | null, extra: Partial<WorkSet> = {}): WorkSet => ({
  id: `set-${++n}`,
  type: 'normal',
  weight,
  reps,
  rpe: null,
  done: true,
  ...extra,
});
const session = (date: string, exercises: Record<string, WorkSet[]>, createdAt = 0): Session => ({
  id: `s-${date}-${createdAt}-${++n}`,
  date,
  name: '',
  notes: '',
  startedAt: null,
  endedAt: null,
  bodyweight: null,
  exercises: Object.entries(exercises).map(([exerciseId, sets], i) => ({ id: `e-${n}-${i}`, exerciseId, notes: '', sets })),
  createdAt,
  updatedAt: createdAt,
});

describe('estimate1RM', () => {
  it('returns the weight for a single', () => expect(estimate1RM(100, 1)).toBe(100));
  it('uses Epley for multiple reps', () => expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1));
  it('ignores empty / invalid input', () => {
    expect(estimate1RM(null, 5)).toBeNull();
    expect(estimate1RM(100, 0)).toBeNull();
    expect(estimate1RM(100, 25)).toBeNull();
  });
});

describe('volume and set counts', () => {
  it('excludes warmups and sets without reps', () => {
    const s = session('2026-01-01', { bench: [set(40, 10, { type: 'warmup' }), set(80, 8), set(80, null), set(80, 6)] });
    expect(sessionVolume(s)).toBe(80 * 8 + 80 * 6);
    expect(sessionWorkingSets(s)).toBe(2);
  });
});

describe('computePRs', () => {
  it('does not flag the first session, then flags genuine improvements once', () => {
    const a = session('2026-01-01', { bench: [set(80, 8), set(80, 8)] });
    const b = session('2026-01-08', { bench: [set(85, 5), set(80, 9)] });
    const c = session('2026-01-15', { bench: [set(80, 5)] });
    const prs = computePRs([c, a, b]); // order shouldn't matter
    expect([...prs.keys()].some((k) => a.exercises[0].sets.some((s) => s.id === k))).toBe(false);
    // 85x5 = 99.2 e1rm, 80x9 = 104 e1rm → e1rm PR on 80x9, weight PR on 85x5
    expect(prs.get(b.exercises[0].sets[1].id)).toEqual(['e1rm']);
    expect(prs.get(b.exercises[0].sets[0].id)).toEqual(['weight']);
    expect(prs.has(c.exercises[0].sets[0].id)).toBe(false);
  });

  it('awards rep PRs for bodyweight exercises', () => {
    const a = session('2026-01-01', { pullup: [set(null, 8)] });
    const b = session('2026-01-03', { pullup: [set(null, 10), set(null, 7)] });
    const prs = computePRs([a, b]);
    expect(prs.get(b.exercises[0].sets[0].id)).toEqual(['reps']);
  });

  it('ignores warmups', () => {
    const a = session('2026-01-01', { squat: [set(100, 5)] });
    const b = session('2026-01-02', { squat: [set(140, 1, { type: 'warmup' }), set(100, 5)] });
    expect(computePRs([a, b]).size).toBe(0);
  });
});

describe('lastPerformance', () => {
  it('finds the most recent earlier session with that exercise', () => {
    const a = session('2026-01-01', { bench: [set(70, 8)] });
    const b = session('2026-01-05', { bench: [set(75, 8)] });
    const other = session('2026-01-06', { squat: [set(100, 5)] });
    const cur = session('2026-01-08', { bench: [set(null, null)] });
    const later = session('2026-01-10', { bench: [set(90, 8)] });
    const res = lastPerformance([a, later, b, other, cur], 'bench', cur);
    expect(res?.date).toBe('2026-01-05');
  });

  it('respects creation order on the same day', () => {
    const morning = session('2026-01-01', { bench: [set(70, 8)] }, 1);
    const evening = session('2026-01-01', { bench: [set(null, null)] }, 2);
    expect(lastPerformance([morning, evening], 'bench', evening)?.date).toBe('2026-01-01');
    expect(lastPerformance([morning, evening], 'bench', morning)).toBeNull();
  });
});

describe('history and records', () => {
  it('summarises per-session bests', () => {
    const a = session('2026-01-01', { bench: [set(80, 8)] });
    const b = session('2026-01-08', { bench: [set(90, 3), set(70, 12)] });
    const h = exerciseHistory([b, a], 'bench');
    expect(h.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-08']);
    const r = exerciseRecords(h);
    expect(r.heaviest?.value).toBe(90);
    expect(r.mostReps?.value).toBe(12);
    expect(r.bestVolume?.value).toBe(90 * 3 + 70 * 12);
    expect(r.sessions).toBe(2);
  });
});

describe('weeklyStreak', () => {
  const today = new Date(2026, 10, 7); // Sat 7 Nov 2026
  it('counts consecutive weeks including the current one', () => {
    const s = ['2026-11-02', '2026-10-28', '2026-10-20'].map((d) => session(d, { bench: [set(80, 5)] }));
    expect(weeklyStreak(s, 1, today)).toBe(3);
  });
  it('still counts if this week has no session yet', () => {
    const s = ['2026-10-28', '2026-10-20'].map((d) => session(d, { bench: [set(80, 5)] }));
    expect(weeklyStreak(s, 1, today)).toBe(2);
  });
  it('breaks on a gap and ignores empty sessions', () => {
    const s = [session('2026-11-03', { bench: [set(80, 5)] }), session('2026-10-27', { bench: [set(null, null)] }), session('2026-10-20', { bench: [set(80, 5)] })];
    expect(weeklyStreak(s, 1, today)).toBe(1);
  });
});

describe('weeklyBuckets & muscles', () => {
  it('buckets sessions into weeks', () => {
    const today = new Date(2026, 10, 7);
    const s = [session('2026-11-03', { bench: [set(100, 5)] }), session('2026-11-04', { bench: [set(100, 5)] }), session('2026-10-27', { bench: [set(50, 10)] })];
    const b = weeklyBuckets(s, 3, 1, today);
    expect(b.map((x) => x.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(b[2]).toMatchObject({ sessions: 2, volume: 1000, sets: 2 });
    expect(b[1].volume).toBe(500);
  });
  it('counts sets per muscle', () => {
    const ex = new Map<string, Exercise>([
      ['bench', { id: 'bench', name: 'Bench', muscle: 'chest', equipment: 'barbell', custom: false, archived: false }],
      ['row', { id: 'row', name: 'Row', muscle: 'back', equipment: 'barbell', custom: false, archived: false }],
    ]);
    const s = [session('2026-11-03', { bench: [set(1, 1), set(1, 1)], row: [set(1, 1)] }), session('2026-01-01', { row: [set(1, 1)] })];
    expect(muscleSetCounts(s, ex, '2026-10-01')).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'back', sets: 1 },
    ]);
  });
});

describe('summarizeSets', () => {
  it('formats weighted and bodyweight sets', () => {
    expect(summarizeSets([set(80, 8), set(null, 12), set(null, null)], (k) => String(k))).toBe('80×8, 12 reps');
  });
});

import { repMaxes, repRangeBests, sessionTitle, weightForReps } from './calc';

describe('rep-range PRs', () => {
  const a = session('2026-02-01', { bench: [set(100, 5), set(90, 8), set(60, 15)] });
  const b = session('2026-02-08', { bench: [set(105, 3), set(95, 6), set(90, 10)] });
  const h = exerciseHistory([a, b], 'bench');

  it('finds the best set in each range', () => {
    const r = repRangeBests(h);
    expect(r.strength).toMatchObject({ weight: 105, reps: 3, date: '2026-02-08' });
    expect(r.hypertrophy).toMatchObject({ weight: 95, reps: 6 });
    expect(r.endurance).toMatchObject({ weight: 60, reps: 15 });
  });

  it('builds a rep-max table where heavier sets satisfy lower rep targets', () => {
    const t = new Map(repMaxes(h).map((x) => [x.target, x.best?.weight ?? null]));
    expect(t.get(1)).toBe(105);
    expect(t.get(4)).toBe(100); // 100×5
    expect(t.get(6)).toBe(95);
    expect(t.get(8)).toBe(90);
    expect(t.get(12)).toBe(60);
    expect(t.get(15)).toBe(60);
  });

  it('inverts Epley', () => {
    expect(weightForReps(estimate1RM(100, 8)!, 8)).toBeCloseTo(100);
  });
});

describe('sessionTitle', () => {
  const ex = new Map<string, Exercise>([
    ['bench', { id: 'bench', name: 'Bench', muscle: 'chest', equipment: 'barbell', custom: false, archived: false }],
    ['push', { id: 'push', name: 'Pushdown', muscle: 'triceps', equipment: 'cable', custom: false, archived: false }],
  ]);
  it('uses the name when set, else the main muscles', () => {
    expect(sessionTitle({ ...session('2026-01-01', {}), name: 'Push A' }, ex)).toBe('Push A');
    expect(sessionTitle(session('2026-01-01', { bench: [set(1, 1), set(1, 1)], push: [set(1, 1)] }), ex)).toBe('Chest & Triceps');
    expect(sessionTitle(session('2026-01-01', {}), ex)).toBe('Workout');
  });
});
