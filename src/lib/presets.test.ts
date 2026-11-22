import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { GymDB } from '../db';
import { DEFAULT_EXERCISES } from './exercises';

describe('preset templates', () => {
  it('ship with a fresh install, and every exercise in them exists', async () => {
    const db = new GymDB('fresh-install');
    await db.open();
    const templates = await db.templates.orderBy('name').toArray();
    expect(templates.map((t) => t.name)).toEqual(['Lower B', 'Upper A']);
    const upper = templates.find((t) => t.name === 'Upper A')!;
    expect(upper.exercises).toHaveLength(12);
    expect(templates.find((t) => t.name === 'Lower B')!.exercises).toHaveLength(6);
    const ids = new Set((await db.exercises.toArray()).map((e) => e.id));
    for (const t of templates) for (const e of t.exercises) expect(ids.has(e.exerciseId), e.exerciseId).toBe(true);
    const names = await Promise.all(upper.exercises.map(async (e) => (await db.exercises.get(e.exerciseId))!.name));
    expect(names).toEqual([
      'Incline Bench Press',
      'Lat Pulldown',
      'Shoulder Press',
      'Cable Fly',
      'Close-grip Row',
      'Upper Back Row',
      'Lateral Raise',
      'Single-arm Cuff Tricep Extension',
      'Tricep Pushdown',
      'Recline Curl',
      'Preacher Curl',
      'Reverse Curl',
    ]);
    db.close();
  });

  it('are added when upgrading an existing v2 database, keeping user data and reusing same-named custom exercises', async () => {
    const name = 'upgrade-from-v2';
    const old = new Dexie(name);
    old.version(2).stores({ sessions: 'id, date, updatedAt', exercises: 'id, name, muscle', templates: 'id, name, updatedAt', settings: 'key', photos: 'date, updatedAt' });
    await old.open();
    // An older library (without the new exercises) plus a custom exercise the user made themselves.
    const newIds = new Set(['shoulder-press', 'close-grip-row', 'upper-back-row', 'single-arm-cuff-tricep-extension', 'recline-curl', 'reverse-curl']);
    await old.table('exercises').bulkAdd(DEFAULT_EXERCISES.filter((e) => !newIds.has(e.id)));
    await old.table('exercises').add({ id: 'custom-rc', name: 'Reverse curl', muscle: 'forearms', equipment: 'cable', custom: true, archived: false });
    await old.table('sessions').add({ id: 'mine', date: '2026-01-01', name: 'Old', notes: '', startedAt: null, endedAt: null, bodyweight: null, exercises: [], createdAt: 1, updatedAt: 1 });
    old.close();

    const db = new GymDB(name);
    await db.open();
    expect(await db.sessions.get('mine')).toBeTruthy();
    expect(await db.exercises.get('shoulder-press')).toBeTruthy();
    expect(await db.exercises.get('reverse-curl')).toBeUndefined(); // not duplicated
    const upper = await db.templates.get('preset-upper-a');
    expect(upper!.exercises.map((e) => e.exerciseId)).toContain('custom-rc');
    db.close();
  });
});
