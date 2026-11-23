import { addDays } from 'date-fns';
import { toKey } from './date';
import { trimNumber } from './units';
import type { Food, FoodEntry, FoodPortion, FoodTrust, Meal, Nutrients } from '../types';

export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
export const MACRO_COLOR = { protein: '#c6f000', carbs: '#ff6e40', fat: '#5ec8ff', kcal: '#3dd68c' } as const;

export const TRUST_INFO: Record<FoodTrust, { label: string; desc: string }> = {
  verified: { label: 'Verified', desc: 'Lab-measured values from USDA FoodData Central (US government, public domain).' },
  checked: { label: 'Checked', desc: 'Open Food Facts product reviewed by one of their moderators. Copied from the package label.' },
  community: { label: 'Unverified', desc: 'Open Food Facts product entered by volunteers and not reviewed yet. Compare with the package label.' },
  yours: { label: 'Yours', desc: 'A food you entered yourself.' },
};

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: null };

/** Nutrients for `grams` of a food given its per-100 g values. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
    fiber: per100.fiber == null ? null : per100.fiber * f,
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber == null && b.fiber == null ? null : (a.fiber ?? 0) + (b.fiber ?? 0),
  };
}

export function sumNutrients(entries: Pick<FoodEntry, 'nutrients'>[]): Nutrients {
  return entries.reduce((acc, e) => addNutrients(acc, e.nutrients), ZERO);
}

/** Share of calories from each macro (4 / 4 / 9 kcal per gram), as fractions. */
export function macroSplit(n: Nutrients): { protein: number; carbs: number; fat: number } {
  const p = n.protein * 4;
  const c = n.carbs * 4;
  const f = n.fat * 9;
  const total = p + c + f;
  return total > 0 ? { protein: p / total, carbs: c / total, fat: f / total } : { protein: 0, carbs: 0, fat: 0 };
}

/**
 * Sanity check for values that can't be right (typos and unit mix-ups are common in community data).
 * Not meant for USDA data: alcohol (7 kcal/g) and fibre make some correct values fail the 4/4/9 rule.
 * Returns a short reason, or null when the numbers look plausible.
 */
export function nutritionWarning(per100: Nutrients): string | null {
  const macros = per100.protein + per100.carbs + per100.fat;
  if (per100.kcal > 900) return 'More than 900 kcal per 100 g is impossible (pure fat is about 900).';
  if (macros > 101) return 'Protein + carbs + fat add up to more than 100 g per 100 g.';
  const fromMacros = per100.protein * 4 + per100.carbs * 4 + per100.fat * 9;
  const hi = Math.max(per100.kcal, fromMacros);
  if (hi >= 40 && Math.abs(per100.kcal - fromMacros) / hi > 0.35) {
    return `Calories (${Math.round(per100.kcal)}) don't match the macros (about ${Math.round(fromMacros)} kcal per 100 g).`;
  }
  return null;
}

export const fmtKcal = (n: number) => Math.round(n).toLocaleString();
export const fmtG = (n: number) => (n >= 100 ? String(Math.round(n)) : trimNumber(n, 1));

export function portionText(e: Pick<FoodEntry, 'portion' | 'grams'>): string {
  if (e.portion) return `${trimNumber(e.portion.count, 2)} × ${e.portion.label}${e.grams != null ? ` (${Math.round(e.grams)} g)` : ''}`;
  return e.grams != null ? `${trimNumber(e.grams, 1)} g` : 'Quick add';
}

/** Build an entry's stored values from a food and an amount. */
export function entryFromFood(food: Food, grams: number, portion: FoodEntry['portion']): Pick<FoodEntry, 'foodId' | 'name' | 'brand' | 'source' | 'trust' | 'per100' | 'grams' | 'portion' | 'nutrients'> {
  return {
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    source: food.source,
    trust: food.trust,
    per100: food.per100,
    grams,
    portion,
    nutrients: scale(food.per100, grams),
  };
}

/* ------------------------------ Daily totals ------------------------------ */

export interface DayNutrition extends Nutrients {
  date: string;
  entries: number;
}

export function dailyNutrition(entries: FoodEntry[]): Map<string, DayNutrition> {
  const out = new Map<string, DayNutrition>();
  for (const e of entries) {
    const cur = out.get(e.date) ?? { date: e.date, entries: 0, ...ZERO };
    out.set(e.date, { ...addNutrients(cur, e.nutrients), date: e.date, entries: cur.entries + 1 });
  }
  return out;
}

/** The last `days` days ending today, with zeros for days nothing was logged. */
export function nutritionSeries(entries: FoodEntry[], days: number, today = new Date()): DayNutrition[] {
  const map = dailyNutrition(entries);
  const out: DayNutrition[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    out.push(map.get(key) ?? { date: key, entries: 0, ...ZERO });
  }
  return out;
}

/** Average over the days that have something logged (empty days are skipped, not counted as 0). */
export function averageLogged(days: DayNutrition[]): (Nutrients & { days: number }) | null {
  const logged = days.filter((d) => d.entries > 0);
  if (!logged.length) return null;
  const sum = logged.reduce<Nutrients>((a, d) => addNutrients(a, d), ZERO);
  const n = logged.length;
  return { kcal: sum.kcal / n, protein: sum.protein / n, carbs: sum.carbs / n, fat: sum.fat / n, fiber: sum.fiber == null ? null : sum.fiber / n, days: n };
}

/* ---------------------------------- USDA ---------------------------------- */

type UsdaRow = [number, string, number, number, number, number, number, number | null, [string, number][]];
interface UsdaFile {
  source: string;
  categories: string[];
  foods: UsdaRow[];
}

export interface UsdaFood extends Food {
  category: string;
  /** lower-cased name for searching */
  key: string;
}

let usdaPromise: Promise<UsdaFood[]> | null = null;

/** Loads the bundled USDA table (cached by the service worker, so it works offline). */
export function loadUsda(fetcher: typeof fetch = fetch): Promise<UsdaFood[]> {
  usdaPromise ??= fetcher('/foods/usda.json')
    .then((r) => {
      if (!r.ok) throw new Error(`USDA food list unavailable (${r.status})`);
      return r.json() as Promise<UsdaFile>;
    })
    .then((file) => file.foods.map((row) => usdaToFood(row, file.categories)))
    .catch((e) => {
      usdaPromise = null;
      throw e;
    });
  return usdaPromise;
}

export function usdaToFood([fdcId, name, cat, kcal, protein, carbs, fat, fiber, portions]: UsdaRow, categories: string[]): UsdaFood {
  return {
    id: `usda-${fdcId}`,
    name,
    brand: '',
    source: 'usda',
    sourceId: String(fdcId),
    sourceNote: 'USDA FoodData Central (SR Legacy)',
    trust: 'verified',
    per100: { kcal, protein, carbs, fat, fiber },
    portions: portions.map(([label, grams]) => ({ label, grams })),
    barcode: null,
    favorite: false,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    category: categories[cat] ?? '',
    key: name.toLowerCase(),
  };
}

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z0-9%-]/g, ''))
    .filter(Boolean);
}

const PROCESSED = ['roll', 'sliced', 'deli', 'luncheon', 'fat-free', 'breaded', 'nugget', 'patties', 'frozen', 'canned', 'fast foods', 'restaurant', 'prepackaged', 'babyfood', 'mechanically', 'glutinous', 'short-grain', 'medium-grain', 'unenriched', 'instant', 'parboiled', 'alaska native', 'northern plains indians', 'sheep', 'goat', 'buffalo', 'human', 'reduced sodium', 'leaves', 'salad', 'dehydrated', 'powder', 'dried', 'buttermilk', 'low sodium', 'bran', 'yolk', 'imitation', 'evaporated', 'condensed'];

/** Whole word (or its plural) = 2, start of a longer word = 1, no match = 0. */
function wordMatch(words: string[], q: string): number {
  let best = 0;
  for (const w of words) {
    if (w === q || w === `${q}s` || w === `${q}es` || q === `${w}s`) return 2;
    if (w.startsWith(q)) best = 1;
  }
  return best;
}

/**
 * Every search word must match the start of a word in the name. Ranked so plain, common foods come first:
 * whole-word matches, words in the first part of the name, then shorter names. Processed variants rank lower
 * unless the search asks for them.
 */
export function searchFoods<T extends { name: string; brand?: string }>(list: T[], query: string, limit = 30): T[] {
  const qs = tokens(query);
  if (!qs.length) return [];
  const scored: { f: T; score: number }[] = [];
  for (const f of list) {
    const key = `${f.name} ${f.brand ?? ''}`.toLowerCase();
    // "hard-boiled" matches both "hard-boiled" and "boiled".
    const words = key.split(/[^a-z0-9%-]+/).filter(Boolean).flatMap((w) => (w.includes('-') ? [w, ...w.split('-')] : [w]));
    const matches = qs.map((q) => wordMatch(words, q));
    if (matches.some((m) => m === 0)) continue;
    const head = key.split(',')[0].trim();
    const headWords = head.split(/[^a-z0-9%-]+/).filter(Boolean);
    let score = key.length * 0.6;
    score -= matches.reduce((a, m) => a + (m === 2 ? 30 : 0), 0);
    score -= qs.filter((q) => wordMatch(headWords, q) > 0).length * 25;
    if (wordMatch(headWords, qs[0]) === 2 && headWords.length <= 2) score -= 25;
    if (/\b(whole|raw)\b/.test(key)) score -= 8;
    for (const w of PROCESSED) if (key.includes(w) && !qs.some((q) => q.length >= 3 && w.startsWith(q))) score += 45;
    // USDA's name for ordinary chicken, and the standard enriched long-grain rice.
    if (key.includes('broilers or fryers')) score -= 30;
    if (key.includes('long-grain, regular, enriched')) score -= 30;
    if (key.startsWith('milk, whole, 3.25%') || key.startsWith('milk, reduced fat, fluid, 2%')) score -= 40;
    if (/^milk, dry\b/.test(key) && !qs.some((q) => q === 'dry' || q === 'powder')) score += 45;
    scored.push({ f, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.f);
}

/* ----------------------------- Open Food Facts ---------------------------- */

const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,checked,states_tags';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Convert an Open Food Facts product. Returns null when it has no calorie value per 100 g. */
export function offToFood(p: any): Food | null {
  if (!p || !p.code) return null;
  const n = p.nutriments ?? {};
  const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null && num(n['energy-kj_100g']) != null) kcal = num(n['energy-kj_100g'])! / 4.184;
  if (kcal == null) return null;
  const name = String(p.product_name_en || p.product_name || '').trim() || `Product ${p.code}`;
  const brand = Array.isArray(p.brands) ? p.brands.join(', ') : String(p.brands ?? '');
  const serving = num(p.serving_quantity);
  const portions: FoodPortion[] = serving && serving > 0 ? [{ label: `1 serving${p.serving_size ? ` (${String(p.serving_size).slice(0, 30)})` : ''}`, grams: serving }] : [];
  return {
    id: `off-${p.code}`,
    name,
    brand: brand.split(',').map((b: string) => b.trim()).filter(Boolean).slice(0, 2).join(', '),
    source: 'off',
    sourceId: String(p.code),
    sourceNote: 'Open Food Facts',
    trust: p.checked === 'on' || p.checked === true ? 'checked' : 'community',
    per100: { kcal: Math.round(kcal), protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0, fiber: num(n.fiber_100g) },
    portions,
    barcode: String(p.code),
    favorite: false,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

export class FoodLookupError extends Error {}

/** Look up a barcode on Open Food Facts. Works straight from the browser. `null` = not found or no nutrition data. */
export async function offByBarcode(code: string): Promise<Food | null> {
  const clean = code.replace(/\D/g, '');
  if (!clean) return null;
  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`);
  } catch {
    throw new FoodLookupError(navigator.onLine === false ? 'You are offline' : "Can't reach Open Food Facts");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new FoodLookupError(`Open Food Facts is busy (${res.status}). Try again in a moment.`);
  const data = await res.json().catch(() => null);
  if (!data || data.status === 0) return null;
  return offToFood(data.product);
}

/**
 * Name search on Open Food Facts. Their search service doesn't allow direct browser calls,
 * so this goes through the Gymbulag server (`npm run server`).
 */
export async function offSearch(query: string, api: { base: string; token: string }): Promise<Food[]> {
  let res: Response;
  try {
    res = await fetch(`${api.base}/food/search?q=${encodeURIComponent(query)}`, { headers: api.token ? { Authorization: `Bearer ${api.token}` } : {} });
  } catch {
    throw new FoodLookupError(navigator.onLine === false ? 'You are offline' : 'Name search needs the Gymbulag server. Barcode scanning works without it.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new FoodLookupError(res.status === 404 || !data ? 'Name search needs the Gymbulag server. Barcode scanning works without it.' : data.error ?? `Search failed (${res.status})`);
  }
  return (data.products as any[]).map(offToFood).filter((f): f is Food => f != null);
}
