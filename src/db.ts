import Dexie, { type Table, type Transaction } from 'dexie';
import { DEFAULT_EXERCISES } from './lib/exercises';
import { presetTemplates } from './lib/presets';
import type { Activity, BodyWeight, Exercise, Food, FoodEntry, Photo, Session, Settings, Template } from './types';

export interface SettingsRow {
  key: 'app';
  value: Settings;
  updatedAt?: number;
}

/** Per-table sync bookkeeping for the MySQL server (never synced itself). */
export interface SyncStateRow {
  table: string;
  /** Server change number we have pulled up to. */
  cursor: number;
  /** id -> fingerprint of the record as last agreed with the server. */
  hashes: Record<string, string>;
}

export class GymDB extends Dexie {
  sessions!: Table<Session, string>;
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  settings!: Table<SettingsRow, string>;
  photos!: Table<Photo, string>;
  activities!: Table<Activity, string>;
  foods!: Table<Food, string>;
  foodlog!: Table<FoodEntry, string>;
  weights!: Table<BodyWeight, string>;
  syncState!: Table<SyncStateRow, string>;

  constructor(name = 'gymbulag') {
    super(name);
    this.version(1).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
      photos: 'date, updatedAt',
    });
    // v3: new built-in exercises + the Upper A / Lower B templates. Existing data is untouched.
    this.version(3)
      .stores({
        sessions: 'id, date, updatedAt',
        exercises: 'id, name, muscle',
        templates: 'id, name, updatedAt',
        settings: 'key',
        photos: 'date, updatedAt',
      })
      .upgrade((tx) => seedLibrary(tx));
    // v4: bookkeeping for syncing with the MySQL server.
    this.version(4).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
      photos: 'date, updatedAt',
      syncState: 'table',
    });
    // v5: walks and runs.
    this.version(5).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
      photos: 'date, updatedAt',
      syncState: 'table',
      activities: 'id, date, updatedAt',
    });
    // v6: food tracking. `foods` is your library, `foodlog` is what you ate each day.
    this.version(6).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
      photos: 'date, updatedAt',
      syncState: 'table',
      activities: 'id, date, updatedAt',
      foods: 'id, name, barcode, updatedAt',
      foodlog: 'id, date, foodId, updatedAt',
    });
    // v7: daily body weight, one per day.
    this.version(7).stores({
      sessions: 'id, date, updatedAt',
      exercises: 'id, name, muscle',
      templates: 'id, name, updatedAt',
      settings: 'key',
      photos: 'date, updatedAt',
      syncState: 'table',
      activities: 'id, date, updatedAt',
      foods: 'id, name, barcode, updatedAt',
      foodlog: 'id, date, foodId, updatedAt',
      weights: 'date, updatedAt',
    });
    this.on('populate', (tx) => seedLibrary(tx));
  }
}

export const db = new GymDB();

/**
 * Add any built-in exercises and preset templates that are missing.
 * If the user already has an exercise with the same name (e.g. a custom "Reverse Curl"),
 * that one is reused instead of creating a duplicate.
 */
export async function seedLibrary(tx: Transaction): Promise<void> {
  const exercises = tx.table<Exercise, string>('exercises');
  const templates = tx.table<Template, string>('templates');
  const existing = await exercises.toArray();
  const ids = new Set(existing.map((e) => e.id));
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
  const alias = new Map<string, string>();
  const toAdd: Exercise[] = [];
  for (const ex of DEFAULT_EXERCISES) {
    if (ids.has(ex.id)) continue;
    const same = byName.get(ex.name.toLowerCase());
    if (same) alias.set(ex.id, same);
    else toAdd.push(ex);
  }
  if (toAdd.length) await exercises.bulkAdd(toAdd);
  const haveTemplates = new Set(await templates.toCollection().primaryKeys());
  const presets = presetTemplates(alias).filter((t) => !haveTemplates.has(t.id));
  if (presets.length) await templates.bulkAdd(presets);
}
