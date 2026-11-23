import type { MuscleGroup } from '../types';

/** Hex colors per muscle group, tuned to read on both light and dark backgrounds. */
export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#ff4d1a',
  back: '#5ec8ff',
  shoulders: '#f0a202',
  biceps: '#c6f000',
  triceps: '#ff8a5b',
  forearms: '#b08968',
  core: '#3dd68c',
  quads: '#7bd66e',
  hamstrings: '#a8d400',
  glutes: '#ff6b8a',
  calves: '#4ecdc4',
  'full body': '#e8ecf0',
  cardio: '#8b949e',
};

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
