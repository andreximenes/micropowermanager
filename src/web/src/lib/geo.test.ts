import { pointOf } from './geo';

describe('pointOf', () => {
  it('swaps GeoJSON longitude-first order into latitude and longitude', () => {
    expect(pointOf({ geo_json: { geometry: { coordinates: [39.28, -6.8] } } })).toEqual({
      latitude: -6.8,
      longitude: 39.28,
    });
  });

  it.each([
    ['no geo', undefined],
    ['null geo', null],
    ['null geo_json', { geo_json: null }],
    ['no geometry', { geo_json: {} }],
  ])('returns null for %s', (_, geo) => {
    expect(pointOf(geo)).toBeNull();
  });
});
