import { describe, expect, it } from 'vitest';
import { formatDelta, formatVolume, formatWeight, kgToUnit, trimNumber, unitToKg } from './units';

describe('units', () => {
  it('round-trips lb through kg storage without drift', () => {
    for (const lb of [45, 135, 225, 315, 2.5, 102.5]) {
      expect(trimNumber(kgToUnit(unitToKg(lb, 'lb'), 'lb'), 2)).toBe(String(lb));
    }
  });
  it('formats weights', () => {
    expect(formatWeight(100, 'kg')).toBe('100');
    expect(formatWeight(100, 'lb')).toBe('220.5');
    expect(formatWeight(null, 'kg')).toBe('—');
  });
  it('abbreviates large volumes', () => {
    expect(formatVolume(12_345, 'kg')).toBe('12.3k');
    expect(formatVolume(250_000, 'kg')).toBe('250k');
  });
});

describe('formatDelta', () => {
  it('signs the change and hides float noise', () => {
    expect(formatDelta(-3.24, 'kg')).toBe('−3.2 kg');
    expect(formatDelta(1.05, 'lb')).toBe('+1.1 lb');
    expect(formatDelta(0.01, 'kg')).toBe('±0 kg');
  });
});
