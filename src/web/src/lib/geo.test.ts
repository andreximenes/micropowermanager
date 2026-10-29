import { areaContains, areaOutlines, canReshape, parsePoint, pointOf } from './geo';

import type { Area } from '@/api/locations';

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

describe('areas', () => {
  const square: Area = {
    type: 'Polygon',
    coordinates: [
      [
        [8, 9],
        [9, 9],
        [9, 10],
        [8, 10],
        [8, 9],
      ],
      [
        [8.4, 9.4],
        [8.6, 9.4],
        [8.6, 9.6],
        [8.4, 9.6],
        [8.4, 9.4],
      ],
    ],
  };
  const islands: Area = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
      [
        [
          [8, 9],
          [9, 9],
          [9, 10],
          [8, 9],
        ],
      ],
    ],
  };

  it('turns GeoJSON rings into latitude-first outlines', () => {
    expect(areaOutlines(square)[0]?.[0]?.[1]).toEqual([9, 9]);
    expect(areaOutlines(islands)).toHaveLength(2);
  });

  it('finds points inside the outer ring and outside its holes', () => {
    expect(areaContains(square, { latitude: 9.2, longitude: 8.2 })).toBe(true);
    expect(areaContains(square, { latitude: 9.5, longitude: 8.5 })).toBe(false);
    expect(areaContains(square, { latitude: 11, longitude: 8.5 })).toBe(false);
  });

  it('lets small outlines be reshaped, not detailed ones', () => {
    expect(canReshape(square)).toBe(true);
    const detailed: Area = {
      type: 'Polygon',
      coordinates: [Array.from({ length: 61 }, (_, index): [number, number] => [index, 0])],
    };
    expect(canReshape(detailed)).toBe(false);
  });

  it('accepts a point inside any polygon of a multi-polygon', () => {
    expect(areaContains(islands, { latitude: 9.1, longitude: 8.8 })).toBe(true);
    expect(areaContains(islands, { latitude: 5, longitude: 5 })).toBe(false);
  });
});

describe('parsePoint', () => {
  it.each([
    ['9.5, 8.25', { latitude: 9.5, longitude: 8.25 }],
    [' -6.8 ,39 ', { latitude: -6.8, longitude: 39 }],
    ['91, 8', null],
    ['9.5', null],
  ])('reads %s', (text, point) => {
    expect(parsePoint(text)).toEqual(point);
  });
});
