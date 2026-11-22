import { z } from 'zod';
import { ACTIVITY_LEVELS, WEIGHT_GOALS } from './tdee';
import { ACTIVITY_KINDS, FOOD_SOURCES, FOOD_TRUST, MEALS, EQUIPMENT, MUSCLE_GROUPS, SET_TYPES, DEFAULT_SETTINGS } from '../types';
import type { Activity, BodyWeight, Food, FoodEntry, Exercise, Photo, Session, Settings, Template, Unit } from '../types';
import { base64ToBuffer, bufferToBase64 } from './photos';
import { kgToUnit, trimNumber } from './units';
import { sortSessions } from './calc';
import { DEFAULT_EXERCISES } from './exercises';

export const BACKUP_APP_ID = 'gymbulag';
export const BACKUP_VERSION = 1;

const num = z.number().finite();
const nullableNum = num.nullable();

const setSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SET_TYPES),
  reps: nullableNum,
  weight: nullableNum,
  rpe: nullableNum.default(null),
  done: z.boolean().default(false),
});

const sessionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().default(''),
  notes: z.string().default(''),
  startedAt: z.string().nullable().default(null),
  endedAt: z.string().nullable().default(null),
  bodyweight: nullableNum.default(null),
  exercises: z.array(
    z.object({
      id: z.string().min(1),
      exerciseId: z.string().min(1),
      notes: z.string().default(''),
      sets: z.array(setSchema),
      unit: z.enum(['kg', 'lb']).optional(),
    }),
  ),
  createdAt: num,
  updatedAt: num,
});

const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  muscle: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  custom: z.boolean(),
  archived: z.boolean().default(false),
  updatedAt: z.number().optional(),
});

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      sets: z.array(z.object({ type: z.enum(SET_TYPES), reps: nullableNum, weight: nullableNum })),
      unit: z.enum(['kg', 'lb']).optional(),
    }),
  ),
  createdAt: num,
  updatedAt: num,
});

const settingsSchema = z
  .object({
    unit: z.enum(['kg', 'lb']),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    restSeconds: num.int().min(0).max(3600),
    autoRestTimer: z.boolean(),
    showRpe: z.boolean(),
    theme: z.enum(['system', 'light', 'dark']),
    barWeight: num.min(0),
    logMode: z.enum(['quick', 'live']),
    defaultSets: num.int().min(1).max(10),
    kcalGoal: nullableNum,
    proteinGoal: nullableNum,
    carbsGoal: nullableNum,
    fatGoal: nullableNum,
    sex: z.enum(['male', 'female']).nullable(),
    heightCm: nullableNum,
    weightKg: nullableNum,
    activityLevel: z.enum(ACTIVITY_LEVELS).nullable(),
    weightGoal: z.enum(WEIGHT_GOALS),
  })
  .partial();

const photoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().regex(/^image\//),
  data: z.string().min(1),
  thumb: z.string().min(1),
  width: num.int().positive(),
  height: num.int().positive(),
  createdAt: num,
  updatedAt: num,
});

const weightSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kg: num.positive(),
  createdAt: num,
  updatedAt: num,
});

const activitySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(ACTIVITY_KINDS),
  steps: nullableNum.default(null),
  distance: nullableNum.default(null),
  duration: nullableNum.default(null),
  notes: z.string().default(''),
  createdAt: num,
  updatedAt: num,
});

const nutrientsSchema = z.object({ kcal: num, protein: num, carbs: num, fat: num, fiber: nullableNum.default(null) });

const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(''),
  source: z.enum(['usda', 'off', 'custom']),
  sourceId: z.string().nullable().default(null),
  sourceNote: z.string().default(''),
  trust: z.enum(FOOD_TRUST),
  per100: nutrientsSchema,
  portions: z.array(z.object({ label: z.string(), grams: num })).default([]),
  barcode: z.string().nullable().default(null),
  favorite: z.boolean().default(false),
  archived: z.boolean().default(false),
  createdAt: num,
  updatedAt: num,
});

const foodEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(MEALS),
  foodId: z.string().nullable().default(null),
  name: z.string().default(''),
  brand: z.string().default(''),
  source: z.enum(FOOD_SOURCES),
  trust: z.enum(FOOD_TRUST),
  per100: nutrientsSchema.nullable().default(null),
  grams: nullableNum.default(null),
  portion: z.object({ label: z.string(), grams: num, count: num }).nullable().default(null),
  nutrients: nutrientsSchema,
  createdAt: num,
  updatedAt: num,
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  sessions: z.array(sessionSchema),
  exercises: z.array(exerciseSchema),
  templates: z.array(templateSchema).default([]),
  settings: settingsSchema.nullable().default(null),
  photos: z.array(photoSchema).default([]),
  activities: z.array(activitySchema).default([]),
  foods: z.array(foodSchema).default([]),
  foodlog: z.array(foodEntrySchema).default([]),
  weights: z.array(weightSchema).default([]),
});

/** Photo as written to a JSON backup (image bytes base64-encoded). */
export type SerializedPhoto = z.infer<typeof photoSchema>;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  sessions: Session[];
  exercises: Exercise[];
  templates: Template[];
  settings: Settings | null;
  photos: SerializedPhoto[];
  activities: Activity[];
  foods: Food[];
  foodlog: FoodEntry[];
  weights: BodyWeight[];
}

export interface Backup {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  sessions: Session[];
  exercises: Exercise[];
  templates: Template[];
  settings: Settings | null;
  photos: Photo[];
  activities: Activity[];
  foods: Food[];
  foodlog: FoodEntry[];
  weights: BodyWeight[];
}

export function buildBackup(data: { sessions: Session[]; exercises: Exercise[]; templates: Template[]; settings: Settings; photos?: Photo[]; activities?: Activity[]; foods?: Food[]; foodlog?: FoodEntry[]; weights?: BodyWeight[] }): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: sortSessions(data.sessions),
    exercises: data.exercises,
    templates: data.templates,
    settings: data.settings,
    photos: (data.photos ?? []).map((p) => ({ ...p, data: bufferToBase64(p.data), thumb: bufferToBase64(p.thumb) })),
    activities: [...(data.activities ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    foods: data.foods ?? [],
    foodlog: [...(data.foodlog ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    weights: [...(data.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'file';
    return { ok: false, error: `This doesn't look like a Gymbulag backup (${where}: ${issue?.message ?? 'invalid'}).` };
  }
  const p = parsed.data;
  // Every exercise referenced by a session must exist, otherwise the log would show "Unknown exercise".
  const known = new Set(p.exercises.map((e) => e.id));
  const missing = new Set<string>();
  for (const s of p.sessions) for (const e of s.exercises) if (!known.has(e.exerciseId)) missing.add(e.exerciseId);
  const exercises: Exercise[] = [
    ...p.exercises,
    ...[...missing].map(
      (id) =>
        // Built-in exercises can be restored by id; anything else becomes a placeholder the user can rename.
        DEFAULT_EXERCISES.find((d) => d.id === id) ?? { id, name: id, muscle: 'full body' as const, equipment: 'other' as const, custom: true, archived: false },
    ),
  ];
  let photos: Photo[];
  try {
    photos = p.photos.map((ph) => ({ ...ph, data: base64ToBuffer(ph.data), thumb: base64ToBuffer(ph.thumb) }));
  } catch {
    return { ok: false, error: 'A photo in this backup is corrupted.' };
  }
  return {
    ok: true,
    backup: {
      ...p,
      photos,
      exercises,
      settings: p.settings ? { ...DEFAULT_SETTINGS, ...p.settings } : null,
    },
  };
}

/** Merge incoming rows by id; the most recently updated version wins. */
export function mergeById<T extends { id: string; updatedAt?: number }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const row of incoming) {
    const cur = map.get(row.id);
    if (!cur || (row.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) map.set(row.id, row);
  }
  return [...map.values()];
}

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(sessions: Session[], exercises: Exercise[], unit: Unit): string {
  const names = new Map(exercises.map((e) => [e.id, e]));
  const header = ['date', 'session', 'exercise', 'muscle', 'set', 'type', `weight_${unit}`, 'reps', 'rpe', 'done', 'notes'];
  const rows: string[] = [header.join(',')];
  for (const s of sortSessions(sessions)) {
    for (const ex of s.exercises) {
      const meta = names.get(ex.exerciseId);
      ex.sets.forEach((set, i) => {
        rows.push(
          [
            s.date,
            s.name,
            meta?.name ?? ex.exerciseId,
            meta?.muscle ?? '',
            i + 1,
            set.type,
            set.weight == null ? null : trimNumber(kgToUnit(set.weight, unit), 2),
            set.reps,
            set.rpe,
            set.done ? 'yes' : 'no',
            i === 0 ? ex.notes : '',
          ]
            .map(csvCell)
            .join(','),
        );
      });
    }
  }
  return rows.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
