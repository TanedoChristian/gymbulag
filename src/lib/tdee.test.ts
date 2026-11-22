import { describe, expect, it } from 'vitest';
import { bmr, calculate, suggestActivity } from './tdee';
import { ageFromBirthDate } from './auth';

describe('bmr (Mifflin–St Jeor)', () => {
  it('matches the published equation', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 1780
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    // 10×60 + 6.25×165 − 5×25 − 161 = 1345.25
    expect(bmr({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 })).toBeCloseTo(1345.25);
  });
});

describe('calculate', () => {
  it('scales by activity and applies the goal', () => {
    const r = calculate({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose' });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(2760); // 1780 × 1.55 = 2759
    expect(r.target).toBe(2260);
    expect(r.protein).toBe(160); // 2.0 g/kg while losing
    expect(r.fat).toBe(63); // 25% of 2260 / 9
    expect(r.protein * 4 + r.fat * 9 + r.carbs * 4).toBeGreaterThan(r.target - 10);
    expect(r.floored).toBe(false);
  });

  it('never suggests less than a safe minimum', () => {
    const r = calculate({ sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose' });
    expect(r.target).toBe(1200);
    expect(r.floored).toBe(true);
  });

  it('keeps fat at least 0.6 g/kg', () => {
    const r = calculate({ sex: 'male', age: 30, heightCm: 170, weightKg: 120, activity: 'sedentary', goal: 'lose' });
    expect(r.fat).toBe(72);
  });
});

describe('suggestActivity', () => {
  it('maps logged training to a level', () => {
    expect(suggestActivity(0, 0)).toBe('sedentary');
    expect(suggestActivity(2, 0)).toBe('light');
    expect(suggestActivity(3, 20)).toBe('moderate');
    expect(suggestActivity(5, 30)).toBe('active');
    expect(suggestActivity(7, 40)).toBe('very');
  });
});

describe('ageFromBirthDate', () => {
  it('counts whole years, birthday-aware', () => {
    const today = new Date(2026, 10, 8);
    expect(ageFromBirthDate('1998-11-08', today)).toBe(28);
    expect(ageFromBirthDate('1998-11-09', today)).toBe(27);
    expect(ageFromBirthDate('nope', today)).toBeNull();
  });
});
