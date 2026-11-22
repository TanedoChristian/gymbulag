/* Daily calorie needs (TDEE) and macro targets.
 * BMR: Mifflin–St Jeor (1990), the equation the Academy of Nutrition and Dietetics found most accurate for adults.
 * TDEE = BMR × activity factor. It's an estimate (±10% for most people); adjust after 2–3 weeks of watching your weight. */

export type Sex = 'male' | 'female';

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_INFO: Record<ActivityLevel, { label: string; desc: string; factor: number }> = {
  sedentary: { label: 'Sedentary', desc: 'Desk job, little exercise', factor: 1.2 },
  light: { label: 'Lightly active', desc: 'Exercise 1–3 days a week', factor: 1.375 },
  moderate: { label: 'Moderately active', desc: 'Exercise 3–5 days a week', factor: 1.55 },
  active: { label: 'Very active', desc: 'Hard exercise 6–7 days a week', factor: 1.725 },
  very: { label: 'Extremely active', desc: 'Physical job plus hard training', factor: 1.9 },
};

export const WEIGHT_GOALS = ['lose', 'lose-slow', 'maintain', 'gain-slow', 'gain'] as const;
export type WeightGoal = (typeof WEIGHT_GOALS)[number];

/** kcal per day vs maintenance. ~7,700 kcal ≈ 1 kg of body fat, so 500/day ≈ 0.45 kg a week. */
export const GOAL_INFO: Record<WeightGoal, { label: string; short: string; delta: number; perWeekKg: number }> = {
  lose: { label: 'Lose ~0.5 kg a week', short: 'Lose', delta: -500, perWeekKg: -0.45 },
  'lose-slow': { label: 'Lose ~0.25 kg a week', short: 'Lose slowly', delta: -250, perWeekKg: -0.23 },
  maintain: { label: 'Keep my weight', short: 'Maintain', delta: 0, perWeekKg: 0 },
  'gain-slow': { label: 'Lean gain ~0.25 kg a week', short: 'Lean gain', delta: 250, perWeekKg: 0.23 },
  gain: { label: 'Gain ~0.5 kg a week', short: 'Gain', delta: 500, perWeekKg: 0.45 },
};

export interface TdeeInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: WeightGoal;
}

export interface TdeeResult {
  bmr: number;
  tdee: number;
  target: number;
  protein: number;
  fat: number;
  carbs: number;
  /** The target was raised to a safe minimum. */
  floored: boolean;
}

/** Basal metabolic rate, kcal/day (Mifflin–St Jeor). */
export function bmr({ sex, age, heightCm, weightKg }: Pick<TdeeInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Don't suggest eating less than this without medical supervision. */
export const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };

const round = (v: number, to: number) => Math.round(v / to) * to;

export function calculate(input: TdeeInput): TdeeResult {
  const b = bmr(input);
  const tdee = b * ACTIVITY_INFO[input.activity].factor;
  let target = tdee + GOAL_INFO[input.goal].delta;
  const floor = MIN_KCAL[input.sex];
  const floored = target < floor;
  if (floored) target = floor;
  target = round(target, 10);

  // Protein: 1.6–2.2 g/kg supports muscle; higher end while dieting to keep muscle.
  const proteinPerKg = input.goal.startsWith('lose') ? 2.0 : 1.8;
  const protein = Math.round(input.weightKg * proteinPerKg);
  // Fat: 25% of calories, but at least 0.6 g/kg for hormones.
  const fat = Math.round(Math.max((target * 0.25) / 9, input.weightKg * 0.6));
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(b), tdee: round(tdee, 10), target, protein, fat, carbs, floored };
}

/**
 * Suggest an activity level from what you actually logged in the last 4 weeks.
 * Counts gym days and walk/run days (a day with both counts once) plus total distance.
 */
export function suggestActivity(trainingDaysPerWeek: number, kmPerWeek: number): ActivityLevel {
  const score = trainingDaysPerWeek + kmPerWeek / 15;
  if (score < 1) return 'sedentary';
  if (score < 3) return 'light';
  if (score < 5.5) return 'moderate';
  if (score < 8) return 'active';
  return 'very';
}
