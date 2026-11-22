import type { ActivityLevel, Sex, WeightGoal } from './lib/tdee';
export type Unit = 'kg' | 'lb';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full body',
  'cardio',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

/** A single set. Weight is always stored in kilograms. */
export interface WorkSet {
  id: string;
  type: SetType;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  done: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  notes: string;
  sets: WorkSet[];
  /** Unit the weights are typed in for this exercise. Falls back to the global setting. */
  unit?: Unit;
}

export interface Session {
  id: string;
  /** Local calendar date, yyyy-MM-dd */
  date: string;
  name: string;
  notes: string;
  /** HH:mm local time */
  startedAt: string | null;
  endedAt: string | null;
  /** kg */
  bodyweight: number | null;
  exercises: SessionExercise[];
  createdAt: number;
  updatedAt: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  custom: boolean;
  archived: boolean;
  /** Set when edited; built-ins start without it. Used to resolve sync conflicts. */
  updatedAt?: number;
}

export interface TemplateSet {
  type: SetType;
  reps: number | null;
  weight: number | null;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: TemplateSet[];
  unit?: Unit;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'system' | 'light' | 'dark';
export type LogMode = 'quick' | 'live';

/** One progress photo per calendar day. Image bytes are stored as ArrayBuffers (most portable across browsers). */
export interface Photo {
  date: string;
  type: string;
  data: ArrayBuffer;
  thumb: ArrayBuffer;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

/** One weigh-in per calendar day (kg). */
export interface BodyWeight {
  date: string;
  kg: number;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  unit: Unit;
  weekStartsOn: 0 | 1;
  restSeconds: number;
  autoRestTimer: boolean;
  showRpe: boolean;
  theme: Theme;
  /** kg */
  barWeight: number;
  /** quick = log after training (no checkboxes / timers); live = track sets as you go */
  logMode: LogMode;
  /** Sets created for an exercise you've never logged before */
  defaultSets: number;
  /** Daily nutrition targets; null = no target */
  kcalGoal: number | null;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
  /** Body stats for the calorie (TDEE) calculator. Age comes from your account. */
  sex: Sex | null;
  heightCm: number | null;
  /** Used when no bodyweight has been logged on a session. */
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  weightGoal: WeightGoal;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'kg',
  weekStartsOn: 1,
  restSeconds: 90,
  autoRestTimer: true,
  showRpe: false,
  theme: 'system',
  barWeight: 20,
  logMode: 'quick',
  defaultSets: 3,
  kcalGoal: null,
  proteinGoal: null,
  carbsGoal: null,
  fatGoal: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  activityLevel: null,
  weightGoal: 'maintain',
};

export const ACTIVITY_KINDS = ['walk', 'run'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** A walk or run. Several can be logged on the same day, next to gym sessions. */
export interface Activity {
  id: string;
  /** Local calendar date, yyyy-MM-dd */
  date: string;
  kind: ActivityKind;
  steps: number | null;
  /** Kilometres */
  distance: number | null;
  /** Minutes */
  duration: number | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/* ---------------------------------- Food ---------------------------------- */

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** Where a food's numbers came from. */
export const FOOD_SOURCES = ['usda', 'off', 'custom', 'quick'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/**
 * How far the numbers can be trusted:
 * - verified:  government lab data (USDA FoodData Central)
 * - checked:   Open Food Facts product reviewed by one of their moderators
 * - community: Open Food Facts product entered by volunteers, not reviewed
 * - yours:     a food you created or typed in yourself
 */
export const FOOD_TRUST = ['verified', 'checked', 'community', 'yours'] as const;
export type FoodTrust = (typeof FOOD_TRUST)[number];

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
}

export interface FoodPortion {
  label: string;
  grams: number;
}

/** A food in your own library: created by you, or saved the first time you log a USDA / Open Food Facts food. */
export interface Food {
  id: string;
  name: string;
  brand: string;
  source: Exclude<FoodSource, 'quick'>;
  /** USDA fdcId or Open Food Facts barcode */
  sourceId: string | null;
  /** Free text for your own foods, e.g. "PhilFCT (FNRI)" or "Package label" */
  sourceNote: string;
  trust: FoodTrust;
  /** Per 100 g */
  per100: Nutrients;
  portions: FoodPortion[];
  barcode: string | null;
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

/** One food eaten on a day. Values are copied in, so editing a food later doesn't rewrite history. */
export interface FoodEntry {
  id: string;
  date: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  brand: string;
  source: FoodSource;
  trust: FoodTrust;
  /** Per 100 g at the time it was logged; null for a quick add */
  per100: Nutrients | null;
  /** Total grams eaten; null for a quick add */
  grams: number | null;
  /** Portion used, e.g. 2 × "1 large" (50 g) */
  portion: { label: string; grams: number; count: number } | null;
  /** Totals for this entry */
  nutrients: Nutrients;
  createdAt: number;
  updatedAt: number;
}
