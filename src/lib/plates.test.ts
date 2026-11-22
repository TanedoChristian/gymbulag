import { describe, expect, it } from 'vitest';
import { calculatePlates, PLATE_SETS } from './plates';

describe('calculatePlates', () => {
  it('loads 100kg on a 20kg bar', () => {
    expect(calculatePlates(100, 20, PLATE_SETS.kg)).toEqual({ perSide: [25, 15], remainder: 0, achieved: 100 });
  });
  it('loads 225lb on a 45lb bar', () => {
    expect(calculatePlates(225, 45, PLATE_SETS.lb).perSide).toEqual([45, 45]);
  });
  it('handles fractional plates', () => {
    expect(calculatePlates(62.5, 20, PLATE_SETS.kg).perSide).toEqual([20, 1.25]);
  });
  it('reports what cannot be loaded', () => {
    const r = calculatePlates(101, 20, PLATE_SETS.kg);
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBe(1);
  });
  it('returns an empty bar when target <= bar', () => {
    expect(calculatePlates(20, 20, PLATE_SETS.kg).perSide).toEqual([]);
  });
});
