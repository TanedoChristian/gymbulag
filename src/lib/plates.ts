import type { Unit } from '../types';

export const PLATE_SETS: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export interface PlateResult {
  perSide: number[];
  /** Weight that could not be loaded (total, both sides) */
  remainder: number;
  achieved: number;
}

/** Greedy plate loading. All values are in the same unit. */
export function calculatePlates(target: number, bar: number, plates: number[]): PlateResult {
  const sorted = [...plates].sort((a, b) => b - a);
  if (!(target > bar)) return { perSide: [], remainder: Math.max(0, target - bar), achieved: bar };
  let side = (target - bar) / 2;
  const perSide: number[] = [];
  const EPS = 1e-6;
  for (const p of sorted) {
    while (side + EPS >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0) * 2;
  const achieved = bar + loaded;
  return { perSide, remainder: Math.max(0, Number((target - achieved).toFixed(4))), achieved };
}
