import { describe, expect, it } from 'vitest';
import { formatDistance, haversineKm, mapsDirectionsUrl, mapsPlaceUrl, parseOverpassGyms } from './nearbyGyms';

describe('nearbyGyms helpers', () => {
  it('formats short and long distances', () => {
    expect(formatDistance(0.25)).toBe('250 m');
    expect(formatDistance(1.2)).toBe('1.2 km');
    expect(formatDistance(12.4)).toBe('12 km');
  });

  it('builds map links', () => {
    const gym = { name: 'Iron Temple', lat: 14.55, lon: 121.03 };
    expect(mapsDirectionsUrl(gym)).toBe('https://www.google.com/maps/dir/?api=1&destination=14.55,121.03');
    expect(mapsPlaceUrl(gym)).toBe('https://www.google.com/maps/search/?api=1&query=14.55,121.03');
  });

  it('parses Overpass elements nearest-first', () => {
    const result = parseOverpassGyms(
      [
        { type: 'node', id: 1, lat: 14.56, lon: 121.04, tags: { name: 'Far Gym', leisure: 'fitness_centre' } },
        { type: 'node', id: 2, lat: 14.551, lon: 121.031, tags: { name: 'Near Gym', leisure: 'fitness_centre', 'addr:street': 'Main' } },
      ],
      14.55,
      121.03,
      5000,
    );
    expect(result.gyms[0].name).toBe('Near Gym');
    expect(result.gyms[0].address).toContain('Main');
    expect(result.gyms[0].distanceKm).toBeLessThan(result.gyms[1].distanceKm);
    expect(haversineKm(14.55, 121.03, 14.55, 121.03)).toBe(0);
  });
});
