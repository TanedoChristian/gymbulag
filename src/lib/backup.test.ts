import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, mergeById, parseBackup, toCSV } from './backup';
import { db } from '../db';
import { createSession, exportAll, importBackup, wipeAllData, newSessionExercise, newSet, createFromTemplate, repeatSession, latestSessionBefore } from './repo';
import { DEFAULT_SETTINGS } from '../types';
import { DEFAULT_EXERCISES } from './exercises';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('parseBackup', () => {
  it('rejects non-JSON and foreign JSON', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
  });

  it('round-trips an export', async () => {
    await createSession('2026-11-01', { name: 'Push', exercises: [newSessionExercise('bench-press', [newSet({ weight: 80, reps: 8 })])] });
    const text = JSON.stringify(buildBackup(await exportAll()));
    const res = parseBackup(text);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.backup.sessions).toHaveLength(1);
      expect(res.backup.sessions[0].exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 8 });
    }
  });

  it('creates placeholders for unknown exercises', () => {
    const res = parseBackup(
      JSON.stringify({
        app: 'gymbulag',
        version: 1,
        exportedAt: new Date().toISOString(),
        exercises: [],
        sessions: [{ id: 'a', date: '2026-01-01', exercises: [{ id: 'x', exerciseId: 'mystery', sets: [] }], createdAt: 1, updatedAt: 1 }],
      }),
    );
    expect(res.ok && res.backup.exercises.map((e) => e.id)).toEqual(['mystery']);
  });
});

describe('import safety', () => {
  it('restores built-in exercises by id instead of making placeholders, and never overwrites them on merge', async () => {
    const res = parseBackup(
      JSON.stringify({
        app: 'gymbulag', version: 1, exportedAt: new Date().toISOString(), exercises: [],
        sessions: [{ id: 'a', date: '2026-01-01', exercises: [{ id: 'x', exerciseId: 'overhead-press', sets: [] }], createdAt: 1, updatedAt: 1 }],
      }),
    );
    expect(res.ok && res.backup.exercises[0].name).toBe('Overhead Press');
    if (!res.ok) return;
    await importBackup({ ...res.backup, exercises: [{ id: 'overhead-press', name: 'junk', muscle: 'cardio', equipment: 'other', custom: true, archived: false }] }, 'merge');
    expect((await db.exercises.get('overhead-press'))?.name).toBe('Overhead Press');
  });
});

describe('mergeById', () => {
  it('keeps the most recently updated row', () => {
    const merged = mergeById([{ id: 'a', updatedAt: 5, v: 'old' }], [{ id: 'a', updatedAt: 9, v: 'new' }, { id: 'b', updatedAt: 1, v: 'b' }]);
    expect(merged.find((x) => x.id === 'a')?.v).toBe('new');
    expect(merged).toHaveLength(2);
  });
});

describe('repo', () => {
  it('seeds the exercise library on first open', async () => {
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });

  it('imports with merge and replace', async () => {
    const existing = await createSession('2026-01-01');
    const parsed = parseBackup(
      JSON.stringify(
        buildBackup({
          sessions: [{ ...existing, id: 'imported', date: '2026-02-02' }],
          exercises: DEFAULT_EXERCISES,
          templates: [],
          settings: { ...DEFAULT_SETTINGS, unit: 'lb' },
          photos: [{ date: '2026-02-02', type: 'image/jpeg', data: new Uint8Array([1, 2, 3]).buffer, thumb: new Uint8Array([4]).buffer, width: 10, height: 20, createdAt: 1, updatedAt: 1 }],
        }),
      ),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const backup = parsed.backup;
    await importBackup(backup, 'merge');
    expect(await db.sessions.count()).toBe(2);
    await importBackup(backup, 'replace');
    expect((await db.sessions.toArray()).map((s) => s.id)).toEqual(['imported']);
    expect((await db.settings.get('app'))?.value.unit).toBe('lb');
    // Photos survive the JSON round trip byte-for-byte.
    const photo = await db.photos.get('2026-02-02');
    expect([...new Uint8Array(photo!.data)]).toEqual([1, 2, 3]);
    await wipeAllData();
    expect(await db.photos.count()).toBe(0);
  });

  it('wipes data but keeps the built-in library', async () => {
    await createSession('2026-01-01');
    await wipeAllData();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });

  it('creates sessions from templates and repeats past sessions with unticked sets', async () => {
    const t = { id: 't', name: 'Legs', exercises: [{ exerciseId: 'squat', sets: [{ type: 'normal' as const, reps: 5, weight: 100 }] }], createdAt: 0, updatedAt: 0 };
    const s = await createFromTemplate('2026-03-01', t);
    expect(s.name).toBe('Legs');
    expect(s.exercises[0].sets[0]).toMatchObject({ reps: 5, weight: 100, done: false });
    await db.sessions.update(s.id, { exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, done: true })) })) });
    const prev = await latestSessionBefore('2026-03-05');
    expect(prev?.id).toBe(s.id);
    const r = await repeatSession('2026-03-05', prev!);
    expect(r.exercises[0].sets[0].done).toBe(false);
    expect(r.exercises[0].sets[0].id).not.toBe(s.exercises[0].sets[0].id);
  });
});

describe('per-exercise unit', () => {
  it('is kept when repeating, templating and backing up a session', async () => {
    const { saveSessionAsTemplate } = await import('./repo');
    const s = await createSession('2026-04-01', { exercises: [newSessionExercise('db-curl', [newSet({ weight: 20.41, reps: 10 })], 'lb')] });
    expect((await repeatSession('2026-04-03', s)).exercises[0].unit).toBe('lb');
    const t = await saveSessionAsTemplate(s, 'Arms');
    expect(t.exercises[0].unit).toBe('lb');
    expect((await createFromTemplate('2026-04-05', t)).exercises[0].unit).toBe('lb');
    const res = parseBackup(JSON.stringify(buildBackup(await exportAll())));
    expect(res.ok && res.backup.sessions.every((x) => x.exercises[0].unit === 'lb')).toBe(true);
  });
});

describe('toCSV', () => {
  it('escapes commas and quotes and converts units', async () => {
    const s = await createSession('2026-01-01', { name: 'Push, "heavy"', exercises: [newSessionExercise('bench-press', [newSet({ weight: 100, reps: 5 })])] });
    const csv = toCSV([s], DEFAULT_EXERCISES, 'lb');
    const line = csv.split('\n')[1];
    expect(line).toContain('"Push, ""heavy"""');
    expect(line).toContain('220.46');
  });
});

describe('templates on a date', () => {
  const t = {
    id: 't1',
    name: 'Upper A',
    exercises: [
      { exerciseId: 'bench-press', sets: [{ type: 'normal' as const, reps: null, weight: null }, { type: 'normal' as const, reps: null, weight: null }] },
      { exerciseId: 'lat-pulldown', sets: [{ type: 'normal' as const, reps: null, weight: null }] },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  it('fills an existing empty session instead of creating a second one', async () => {
    const { addTemplateToDate } = await import('./repo');
    const empty = await createSession('2026-11-08');
    const s = await addTemplateToDate('2026-11-08', t);
    expect(s.id).toBe(empty.id);
    expect(await db.sessions.where('date').equals('2026-11-08').count()).toBe(1);
    expect(s.name).toBe('Upper A');
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'lat-pulldown']);
    expect(s.exercises[0].sets).toHaveLength(2);
  });

  it('creates a new session when the day already has a logged one', async () => {
    const { addTemplateToDate } = await import('./repo');
    await createSession('2026-11-08', { exercises: [newSessionExercise('squat')] });
    await addTemplateToDate('2026-11-08', t);
    expect(await db.sessions.where('date').equals('2026-11-08').count()).toBe(2);
  });

  it('applyTemplate skips exercises already in the session and keeps a custom name', async () => {
    const { applyTemplate, blankSession } = await import('./repo');
    const s = { ...blankSession('2026-11-08', 'My push'), exercises: [newSessionExercise('bench-press')] };
    const r = applyTemplate(s, t);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.session.name).toBe('My push');
    expect(r.session.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'lat-pulldown']);
  });
});

describe('activities', () => {
  it('round-trip through backup, merge and wipe', async () => {
    const { createActivity } = await import('./repo');
    await createActivity('2026-11-02', 'run', { distance: 5, duration: 27 });
    await createActivity('2026-11-02', 'walk', { steps: 8000 });
    const res = parseBackup(JSON.stringify(buildBackup(await exportAll())));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.backup.activities).toHaveLength(2);
    await wipeAllData();
    expect(await db.activities.count()).toBe(0);
    await importBackup(res.backup, 'merge');
    expect((await db.activities.toArray()).map((a) => a.kind).sort()).toEqual(['run', 'walk']);
  });

  it('accepts older backups without activities', () => {
    const res = parseBackup(JSON.stringify({ app: 'gymbulag', version: 1, exportedAt: new Date().toISOString(), exercises: [], sessions: [] }));
    expect(res.ok && res.backup.activities).toEqual([]);
  });
});

describe('food', () => {
  it('round-trips foods, entries and goals through a backup', async () => {
    const { createCustomFood, addFoodEntry, saveSettings } = await import('./repo');
    const { entryFromFood } = await import('./food');
    const food = await createCustomFood({ name: 'Adobo', brand: '', sourceNote: 'PhilFCT (FNRI)', per100: { kcal: 200, protein: 18, carbs: 3, fat: 13, fiber: null }, portions: [{ label: '1 cup', grams: 150 }], barcode: null });
    await addFoodEntry('2026-11-08', { meal: 'lunch', ...entryFromFood(food, 150, { label: '1 cup', grams: 150, count: 1 }) });
    await saveSettings({ proteinGoal: 150 });
    const res = parseBackup(JSON.stringify(buildBackup(await exportAll())));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.backup.foods[0]).toMatchObject({ trust: 'yours', sourceNote: 'PhilFCT (FNRI)' });
    expect(res.backup.foodlog[0].nutrients.kcal).toBe(300);
    expect(res.backup.settings?.proteinGoal).toBe(150);
    await wipeAllData();
    await importBackup(res.backup, 'replace');
    expect(await db.foodlog.count()).toBe(1);
    expect((await db.foods.get(food.id))?.name).toBe('Adobo');
  });
});

describe('body weight', () => {
  it('sets, clears and round-trips weigh-ins through a backup', async () => {
    const { setBodyWeight } = await import('./repo');
    await setBodyWeight('2026-11-01', 80.4);
    await setBodyWeight('2026-11-08', 79.1);
    await setBodyWeight('2026-11-09', 79);
    await setBodyWeight('2026-11-09', null);
    expect(await db.weights.count()).toBe(2);
    const res = parseBackup(JSON.stringify(buildBackup(await exportAll())));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.backup.weights.map((w) => w.kg)).toEqual([80.4, 79.1]);
    await wipeAllData();
    expect(await db.weights.count()).toBe(0);
    await importBackup(res.backup, 'merge');
    expect((await db.weights.get('2026-11-08'))?.kg).toBe(79.1);
  });

  it('accepts older backups without weigh-ins', () => {
    const res = parseBackup(JSON.stringify({ app: 'gymbulag', version: 1, exportedAt: new Date().toISOString(), exercises: [], sessions: [] }));
    expect(res.ok && res.backup.weights).toEqual([]);
  });
});
