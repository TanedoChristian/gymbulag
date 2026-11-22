import type { MuscleGroup } from '../types';

/** Hex colors per muscle group, tuned to read on both light and dark backgrounds. */
export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f59e0b',
  biceps: '#8b5cf6',
  triceps: '#d946ef',
  forearms: '#a16207',
  core: '#14b8a6',
  quads: '#22c55e',
  hamstrings: '#84cc16',
  glutes: '#ec4899',
  calves: '#06b6d4',
  'full body': '#6366f1',
  cardio: '#64748b',
};

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
