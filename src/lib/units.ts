import type { Unit } from '../types';

export const LB_PER_KG = 2.20462262185;

export function otherUnit(unit: Unit): Unit {
  return unit === 'kg' ? 'lb' : 'kg';
}

export function kgToUnit(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

export function unitToKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

/** Trim a number to at most `decimals` places without trailing zeros. */
export function trimNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(decimals)));
}

export function formatWeight(kg: number | null | undefined, unit: Unit, decimals = 1): string {
  if (kg == null) return '—';
  return trimNumber(kgToUnit(kg, unit), decimals);
}

const intl = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
export function formatVolume(kg: number, unit: Unit): string {
  const v = kgToUnit(kg, unit);
  if (v >= 100_000) return `${trimNumber(v / 1000, 0)}k`;
  if (v >= 10_000) return `${trimNumber(v / 1000, 1)}k`;
  return intl.format(v);
}

/** Signed change, e.g. "+1.2 kg", "−3.4 kg", "±0 kg". */
export function formatDelta(diff: number, unit: Unit, decimals = 1): string {
  const r = Number(diff.toFixed(decimals));
  if (r === 0) return `±0 ${unit}`;
  return `${r > 0 ? '+' : '−'}${trimNumber(Math.abs(r), decimals)} ${unit}`;
}
