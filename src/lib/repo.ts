import { db } from '../db';
import type { Backup } from './backup';
import { mergeById } from './backup';
import { DEFAULT_EXERCISES } from './exercises';
import { presetTemplates } from './presets';
import { uid } from './id';
import { compareSessions } from './calc';
import { DEFAULT_SETTINGS, type Activity, type ActivityKind, type BodyWeight, type Food, type FoodEntry, type Exercise, type Session, type SessionExercise, type Settings, type Template, type Unit, type WorkSet } from '../types';

export function newSet(partial: Partial<WorkSet> = {}): WorkSet {
  return { id: uid(), type: 'normal', reps: null, weight: null, rpe: null, done: false, ...partial };
}

export function newSessionExercise(exerciseId: string, sets: WorkSet[] = [newSet()], unit?: Unit): SessionExercise {
  return { id: uid(), exerciseId, notes: '', sets, ...(unit ? { unit } : {}) };
}

export function blankSession(date: string, name = ''): Session {
  const now = Date.now();
  return { id: uid(), date, name, notes: '', startedAt: null, endedAt: null, bodyweight: null, exercises: [], createdAt: now, updatedAt: now };
}

export async function createSession(date: string, init?: Partial<Session>): Promise<Session> {
  const s = { ...blankSession(date), ...init, id: uid(), date, createdAt: Date.now(), updatedAt: Date.now() };
  await db.sessions.add(s);
  return s;
}

/** Fresh session exercises (new ids, un-ticked sets) built from a template. */
export function exercisesFromTemplate(t: Template): SessionExercise[] {
  return t.exercises.map((te) =>
    newSessionExercise(
      te.exerciseId,
      (te.sets.length ? te.sets : [{ type: 'normal' as const, reps: null, weight: null }]).map((ts) => newSet({ type: ts.type, reps: ts.reps, weight: ts.weight })),
      te.unit,
    ),
  );
}

export async function createFromTemplate(date: string, t: Template): Promise<Session> {
  return createSession(date, { name: t.name, exercises: exercisesFromTemplate(t) });
}

/**
 * Pull a template into an existing session. Exercises already in the session are skipped so nothing is doubled up.
 * An unnamed session takes the template's name.
 */
export function applyTemplate(session: Session, t: Template): { session: Session; added: number; skipped: number } {
  const present = new Set(session.exercises.map((e) => e.exerciseId));
  const fresh = exercisesFromTemplate(t).filter((e) => !present.has(e.exerciseId));
  return {
    session: { ...session, name: session.name.trim() ? session.name : t.name, exercises: [...session.exercises, ...fresh] },
    added: fresh.length,
    skipped: t.exercises.length - fresh.length,
  };
}

/**
 * Put a template on a date. If that day already has an empty session (e.g. you tapped "Start logging" first),
 * the template fills it instead of creating a second session.
 */
export async function addTemplateToDate(date: string, t: Template): Promise<Session> {
  const sameDay = (await db.sessions.where('date').equals(date).sortBy('createdAt')).find((s) => s.exercises.length === 0);
  if (sameDay) {
    const next = { ...applyTemplate(sameDay, t).session, name: sameDay.name.trim() || t.name, updatedAt: Date.now() };
    await db.sessions.put(next);
    return next;
  }
  return createFromTemplate(date, t);
}

/** Copy a past session's structure and numbers onto a new date. Sets start un-ticked. */
export async function repeatSession(date: string, source: Session): Promise<Session> {
  return createSession(date, {
    name: source.name,
    exercises: source.exercises.map((ex) =>
      newSessionExercise(
        ex.exerciseId,
        ex.sets.map((s) => newSet({ type: s.type, reps: s.reps, weight: s.weight, rpe: null })),
        ex.unit,
      ),
    ),
  });
}

export async function latestSessionBefore(date: string): Promise<Session | undefined> {
  const candidates = await db.sessions.where('date').below(date).toArray();
  return candidates.filter((s) => s.exercises.length > 0).sort(compareSessions).pop();
}

export async function saveSessionAsTemplate(session: Session, name: string): Promise<Template> {
  const now = Date.now();
  const t: Template = {
    id: uid(),
    name: name.trim() || session.name || 'Template',
    exercises: session.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({ type: s.type, reps: s.reps, weight: s.weight })),
      ...(ex.unit ? { unit: ex.unit } : {}),
    })),
    createdAt: now,
    updatedAt: now,
  };
  await db.templates.add(t);
  return t;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const cur = (await db.settings.get('app'))?.value ?? DEFAULT_SETTINGS;
    await db.settings.put({ key: 'app', value: { ...cur, ...patch }, updatedAt: Date.now() });
  });
}

export async function createCustomExercise(data: Pick<Exercise, 'name' | 'muscle' | 'equipment'>): Promise<Exercise> {
  const ex: Exercise = { id: `custom-${uid()}`, name: data.name.trim(), muscle: data.muscle, equipment: data.equipment, custom: true, archived: false, updatedAt: Date.now() };
  await db.exercises.add(ex);
  return ex;
}

export async function createActivity(date: string, kind: ActivityKind, init: Partial<Activity> = {}): Promise<Activity> {
  const now = Date.now();
  const a: Activity = { steps: null, distance: null, duration: null, notes: '', ...init, id: uid(), date, kind, createdAt: now, updatedAt: now };
  await db.activities.add(a);
  return a;
}

/** Set (or clear, with null) the body weight logged on a day. kg. */
export async function setBodyWeight(date: string, kg: number | null): Promise<BodyWeight | undefined> {
  const existing = await db.weights.get(date);
  if (kg == null || !(kg > 0)) {
    if (existing) await db.weights.delete(date);
    return existing;
  }
  const now = Date.now();
  await db.weights.put({ date, kg, createdAt: existing?.createdAt ?? now, updatedAt: now });
  return existing;
}

export async function updateActivity(id: string, patch: Partial<Omit<Activity, 'id' | 'createdAt'>>): Promise<void> {
  await db.activities.update(id, { ...patch, updatedAt: Date.now() });
}

/* ---------------------------------- Food ---------------------------------- */

/**
 * Keep a copy of a USDA / Open Food Facts food in your library the first time you log it,
 * so it shows up in recents, works offline and syncs. Your own foods are stored as they are.
 */
export async function saveFoodToLibrary(food: Food): Promise<Food> {
  const existing = await db.foods.get(food.id);
  if (existing && existing.source !== 'custom') {
    // Refresh the numbers from the source but keep your favourite flag.
    const next = { ...existing, ...pickFood(food), favorite: existing.favorite, archived: false, createdAt: existing.createdAt, updatedAt: Date.now() };
    await db.foods.put(next);
    return next;
  }
  if (existing) return existing;
  const now = Date.now();
  const next = { ...pickFood(food), createdAt: now, updatedAt: now };
  await db.foods.put(next);
  return next;
}

/** Strip extra fields (e.g. the USDA search key) so only the Food shape is stored. */
function pickFood(f: Food): Food {
  const { id, name, brand, source, sourceId, sourceNote, trust, per100, portions, barcode, favorite, archived, createdAt, updatedAt } = f;
  return { id, name, brand, source, sourceId, sourceNote, trust, per100, portions, barcode, favorite, archived, createdAt, updatedAt };
}

export async function createCustomFood(data: Omit<Food, 'id' | 'source' | 'sourceId' | 'trust' | 'favorite' | 'archived' | 'createdAt' | 'updatedAt'>): Promise<Food> {
  const now = Date.now();
  const food: Food = { ...data, id: `custom-${uid()}`, source: 'custom', sourceId: null, trust: 'yours', favorite: false, archived: false, createdAt: now, updatedAt: now };
  await db.foods.add(food);
  return food;
}

export async function addFoodEntry(date: string, data: Omit<FoodEntry, 'id' | 'date' | 'createdAt' | 'updatedAt'>): Promise<FoodEntry> {
  const now = Date.now();
  const entry: FoodEntry = { ...data, id: uid(), date, createdAt: now, updatedAt: now };
  await db.foodlog.add(entry);
  return entry;
}

export async function updateFoodEntry(id: string, patch: Partial<Omit<FoodEntry, 'id' | 'createdAt'>>): Promise<void> {
  await db.foodlog.update(id, { ...patch, updatedAt: Date.now() });
}

/** Copy every entry of one meal on `from` to the same meal on `to`. */
export async function copyMeal(from: string, to: string, meal: FoodEntry['meal']): Promise<number> {
  const src = (await db.foodlog.where('date').equals(from).toArray()).filter((e) => e.meal === meal);
  const now = Date.now();
  await db.foodlog.bulkAdd(src.map((e, i) => ({ ...e, id: uid(), date: to, createdAt: now + i, updatedAt: now + i })));
  return src.length;
}

export async function exportAll() {
  const [sessions, exercises, templates, settingsRow, photos, activities, foods, foodlog, weights] = await Promise.all([
    db.sessions.toArray(),
    db.exercises.toArray(),
    db.templates.toArray(),
    db.settings.get('app'),
    db.photos.toArray(),
    db.activities.toArray(),
    db.foods.toArray(),
    db.foodlog.toArray(),
    db.weights.toArray(),
  ]);
  return { sessions, exercises, templates, photos, activities, foods, foodlog, weights, settings: { ...DEFAULT_SETTINGS, ...(settingsRow?.value ?? {}) } };
}

export async function importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<{ sessions: number }> {
  await db.transaction('rw', [db.sessions, db.exercises, db.templates, db.settings, db.photos, db.activities, db.foods, db.foodlog, db.weights], async () => {
    if (mode === 'replace') {
      await Promise.all([db.sessions.clear(), db.templates.clear(), db.exercises.clear(), db.photos.clear(), db.activities.clear(), db.foods.clear(), db.foodlog.clear(), db.weights.clear()]);
      await db.activities.bulkPut(backup.activities);
      await db.weights.bulkPut(backup.weights);
      await db.foods.bulkPut(backup.foods);
      await db.foodlog.bulkPut(backup.foodlog);
      await db.photos.bulkPut(backup.photos);
      // Keep built-in exercises available even if the backup didn't include all of them.
      await db.exercises.bulkPut(DEFAULT_EXERCISES);
      await db.exercises.bulkPut(backup.exercises);
      await db.sessions.bulkPut(backup.sessions);
      await db.templates.bulkPut(backup.templates);
      if (backup.settings) await db.settings.put({ key: 'app', value: backup.settings });
    } else {
      const [sessions, templates, photos, activities] = await Promise.all([db.sessions.toArray(), db.templates.toArray(), db.photos.toArray(), db.activities.toArray()]);
      await db.sessions.bulkPut(mergeById(sessions, backup.sessions));
      await db.activities.bulkPut(mergeById(activities, backup.activities));
      await db.foods.bulkPut(mergeById(await db.foods.toArray(), backup.foods));
      await db.foodlog.bulkPut(mergeById(await db.foodlog.toArray(), backup.foodlog));
      await db.templates.bulkPut(mergeById(templates, backup.templates));
      const weightByDate = new Map((await db.weights.toArray()).map((w) => [w.date, w]));
      await db.weights.bulkPut(backup.weights.filter((w) => (weightByDate.get(w.date)?.updatedAt ?? -1) <= w.updatedAt));
      const photoByDate = new Map(photos.map((p) => [p.date, p]));
      await db.photos.bulkPut(backup.photos.filter((p) => (photoByDate.get(p.date)?.updatedAt ?? -1) <= p.updatedAt));
      // Add exercises we don't have; update custom ones; never overwrite a built-in exercise.
      const existing = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
      await db.exercises.bulkPut(
        backup.exercises.filter((e) => {
          const cur = existing.get(e.id);
          return !cur || (cur.custom && e.custom);
        }),
      );
    }
  });
  return { sessions: backup.sessions.length };
}

/**
 * Clear this device back to a fresh install.
 * everywhere: keep the sync bookkeeping, so the next sync deletes the same records from your account too.
 * Otherwise the bookkeeping is cleared and the server copy is left alone (used when logging out).
 */
export async function wipeAllData({ everywhere = false } = {}): Promise<void> {
  await db.transaction('rw', [db.sessions, db.exercises, db.templates, db.settings, db.photos, db.activities, db.foods, db.foodlog, db.weights, db.syncState], async () => {
    await Promise.all([db.sessions.clear(), db.templates.clear(), db.exercises.clear(), db.settings.clear(), db.photos.clear(), db.activities.clear(), db.foods.clear(), db.foodlog.clear(), db.weights.clear(), everywhere ? null : db.syncState.clear()]);
    await db.exercises.bulkAdd(DEFAULT_EXERCISES);
    await db.templates.bulkAdd(presetTemplates());
  });
}
