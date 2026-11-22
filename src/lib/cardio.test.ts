import { describe, expect, it } from 'vitest';
import { activityPace, cardioDayStreak, cardioRecords, dailySeries, dayTotals, formatPace, weeklyCardio } from './cardio';
import type { Activity } from '../types';

let n = 0;
function act(date: string, kind: Activity['kind'], p: Partial<Activity> = {}): Activity {
  n++;
  return { id: `a${n}`, date, kind, steps: null, distance: null, duration: null, notes: '', createdAt: n, updatedAt: n, ...p };
}

describe('pace', () => {
  it('computes and formats min/km', () => {
    expect(activityPace({ distance: 5, duration: 30 })).toBe(6);
    expect(activityPace({ distance: null, duration: 30 })).toBeNull();
    expect(formatPace(6.2)).toBe('6:12 /km');
    expect(formatPace(4.999)).toBe('5:00 /km');
    expect(formatPace(null)).toBe('—');
  });
});

describe('dayTotals', () => {
  it('adds up several activities on one day and skips empty ones', () => {
    const t = dayTotals([
      act('2026-11-02', 'walk', { steps: 4000, distance: 3 }),
      act('2026-11-02', 'run', { distance: 5, duration: 28 }),
      act('2026-11-03', 'walk'),
    ]);
    expect(t.size).toBe(1);
    expect(t.get('2026-11-02')).toMatchObject({ steps: 4000, distance: 8, walkKm: 3, runKm: 5, duration: 28, count: 2 });
  });
});

describe('series', () => {
  const today = new Date(2026, 10, 8); // Sun Nov 8 2026
  const list = [act('2026-11-08', 'walk', { steps: 9000 }), act('2026-11-02', 'run', { distance: 10 }), act('2026-11-03', 'walk', { distance: 2 })];

  it('fills empty days', () => {
    const s = dailySeries(list, 7, today);
    expect(s).toHaveLength(7);
    expect(s[0].date).toBe('2026-11-02');
    expect(s[6]).toMatchObject({ date: '2026-11-08', steps: 9000 });
    expect(s[3].count).toBe(0);
  });

  it('buckets by week', () => {
    const w = weeklyCardio(list, 2, 1, today);
    expect(w.map((x) => x.weekStart)).toEqual(['2026-10-26', '2026-11-02']);
    expect(w[1]).toMatchObject({ distance: 12, runKm: 10, walkKm: 2, steps: 9000, activeDays: 3 });
  });

  it('counts a day streak', () => {
    expect(cardioDayStreak(list, today)).toBe(1);
    expect(cardioDayStreak([act('2026-11-06', 'walk', { steps: 1 }), act('2026-11-07', 'walk', { steps: 1 })], today)).toBe(2);
  });
});

describe('cardioRecords', () => {
  it('finds longest, fastest, most steps and best week', () => {
    const r = cardioRecords(
      [
        act('2026-10-01', 'run', { distance: 5, duration: 30 }),
        act('2026-10-05', 'run', { distance: 8, duration: 44 }),
        act('2026-10-06', 'run', { distance: 0.5, duration: 2 }),
        act('2026-10-07', 'walk', { distance: 6, steps: 8000 }),
        act('2026-10-07', 'walk', { steps: 5000 }),
      ],
      1,
    );
    expect(r.longestRun).toMatchObject({ value: 8, date: '2026-10-05' });
    expect(r.longestWalk?.value).toBe(6);
    expect(r.fastestRun?.value).toBe(5.5);
    expect(r.mostStepsDay).toEqual({ value: 13000, date: '2026-10-07' });
    expect(r.bestWeekKm?.value).toBeCloseTo(14.5);
  });
});
