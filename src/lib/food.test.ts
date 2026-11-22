import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nutritionWarning, averageLogged, dailyNutrition, entryFromFood, loadUsda, macroSplit, nutritionSeries, offToFood, scale, searchFoods, sumNutrients } from './food';
import type { FoodEntry } from '../types';

const usdaFetch = (async () => new Response(readFileSync(new URL('../../public/foods/usda.json', import.meta.url)))) as unknown as typeof fetch;

describe('maths', () => {
  it('scales per-100 g values', () => {
    expect(scale({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 }, 150)).toEqual({ kcal: 247.5, protein: 46.5, carbs: 0, fat: 5.4, fiber: 0 });
  });
  it('splits calories by macro', () => {
    const s = macroSplit({ kcal: 0, protein: 25, carbs: 25, fat: 0, fiber: null });
    expect(s).toEqual({ protein: 0.5, carbs: 0.5, fat: 0 });
  });
});

function entry(date: string, kcal: number, protein: number): FoodEntry {
  return { id: date + kcal, date, meal: 'lunch', foodId: null, name: 'x', brand: '', source: 'quick', trust: 'yours', per100: null, grams: null, portion: null, nutrients: { kcal, protein, carbs: 0, fat: 0, fiber: null }, createdAt: 0, updatedAt: 0 };
}

describe('daily totals', () => {
  const list = [entry('2026-11-07', 500, 30), entry('2026-11-07', 700, 40), entry('2026-11-05', 2000, 150)];
  it('adds up a day', () => {
    expect(dailyNutrition(list).get('2026-11-07')).toMatchObject({ kcal: 1200, protein: 70, entries: 2 });
    expect(sumNutrients(list).kcal).toBe(3200);
  });
  it('averages only logged days', () => {
    const s = nutritionSeries(list, 7, new Date(2026, 10, 8));
    expect(s).toHaveLength(7);
    expect(averageLogged(s)).toMatchObject({ kcal: 1600, protein: 110, days: 2 });
    expect(averageLogged(nutritionSeries([], 7))).toBeNull();
  });
});

describe('USDA table', () => {
  it('loads real values and finds common foods', async () => {
    const foods = await loadUsda(usdaFetch);
    expect(foods.length).toBeGreaterThan(7000);
    const chicken = foods.find((f) => f.sourceId === '171477')!;
    expect(chicken).toMatchObject({ trust: 'verified', per100: { kcal: 165, protein: 31 } });
    const egg = searchFoods(foods, 'egg whole boiled')[0];
    expect(egg.name).toMatch(/^Egg, whole, cooked, hard-boiled/);
    expect(egg.portions.find((p) => p.label === '1 large')?.grams).toBe(50);
    expect(searchFoods(foods, 'rice white cooked')[0].name).toBe('Rice, white, long-grain, regular, enriched, cooked');
    expect(searchFoods(foods, 'chicken breast roasted')[0].name).toBe('Chicken, broilers or fryers, breast, meat only, cooked, roasted');
    expect(searchFoods(foods, 'chicken breast roll')[0].name).toMatch(/roll/);
    const e = entryFromFood(chicken, 200, null);
    expect(e.nutrients.protein).toBe(62);
  });
});

describe('Open Food Facts', () => {
  it('maps trust from the moderator flag and skips products without calories', () => {
    const base = { code: '123', product_name: 'Bar', brands: 'Acme, Acme Foods, X', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 20 }, serving_quantity: 50, serving_size: '1 bar' };
    expect(offToFood({ ...base, checked: 'on' })).toMatchObject({ id: 'off-123', trust: 'checked', brand: 'Acme, Acme Foods', per100: { kcal: 400, protein: 20, carbs: 0 }, portions: [{ grams: 50 }] });
    expect(offToFood(base)?.trust).toBe('community');
    expect(offToFood({ ...base, nutriments: { 'energy-kj_100g': 418.4 } })?.per100.kcal).toBe(100);
    expect(offToFood({ ...base, nutriments: {} })).toBeNull();
  });
});

describe('nutritionWarning', () => {
  it('flags impossible or inconsistent values', () => {
    expect(nutritionWarning({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 })).toBeNull();
    expect(nutritionWarning({ kcal: 7, protein: 9, carbs: 60, fat: 20, fiber: null })).toMatch(/don't match/);
    expect(nutritionWarning({ kcal: 2000, protein: 0, carbs: 0, fat: 100, fiber: null })).toMatch(/900/);
    expect(nutritionWarning({ kcal: 400, protein: 50, carbs: 50, fat: 20, fiber: null })).toMatch(/100 g/);
    expect(nutritionWarning({ kcal: 15, protein: 1, carbs: 2, fat: 0, fiber: null })).toBeNull();
  });
});
