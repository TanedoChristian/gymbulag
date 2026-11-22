import { describe, expect, it } from 'vitest';
import { DEFAULT_EXERCISES } from './exercises';
import { getExerciseGuide } from './exerciseGuides';
import { getMotionProfile } from './exerciseMotions';

describe('exercise motion profiles', () => {
  it('provides valid joint poses for every built-in exercise', () => {
    for (const exercise of DEFAULT_EXERCISES) {
      const guide = getExerciseGuide(exercise.id, exercise.muscle, exercise.name);
      const profile = getMotionProfile(exercise.id, guide.demo, exercise.equipment);

      expect(profile.frames.length, exercise.name).toBeGreaterThan(0);
      expect(profile.instruction.length, exercise.name).toBeGreaterThan(12);
      expect(profile.tempoMs, exercise.name).toBeGreaterThanOrEqual(1000);

      for (const frame of profile.frames) {
        for (const point of Object.values(frame.pose)) {
          expect(Number.isFinite(point.x), `${exercise.name}: ${frame.label} x`).toBe(true);
          expect(Number.isFinite(point.y), `${exercise.name}: ${frame.label} y`).toBe(true);
          expect(point.x, `${exercise.name}: ${frame.label} x bounds`).toBeGreaterThanOrEqual(0);
          expect(point.x, `${exercise.name}: ${frame.label} x bounds`).toBeLessThanOrEqual(320);
          expect(point.y, `${exercise.name}: ${frame.label} y bounds`).toBeGreaterThanOrEqual(0);
          expect(point.y, `${exercise.name}: ${frame.label} y bounds`).toBeLessThanOrEqual(300);
        }
      }
    }
  });

  it('uses visibly different key poses for moving exercises', () => {
    const staticHolds = new Set(['plank']);
    for (const exercise of DEFAULT_EXERCISES) {
      if (staticHolds.has(exercise.id)) continue;
      const guide = getExerciseGuide(exercise.id, exercise.muscle, exercise.name);
      const profile = getMotionProfile(exercise.id, guide.demo, exercise.equipment);
      expect(profile.frames.length, exercise.name).toBeGreaterThanOrEqual(2);
      expect(profile.frames[0].pose, exercise.name).not.toEqual(profile.frames.at(-1)?.pose);
    }
  });
});
