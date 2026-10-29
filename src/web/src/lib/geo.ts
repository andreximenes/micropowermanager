import type { Area } from '@/api/locations';
import type { LatLng } from '@/components/LocationMap';

type Geo =
  { geo_json?: { geometry?: { coordinates: [number, number] } } | null } | null | undefined;

/** MPM stores points as GeoJSON, which orders coordinates longitude first. */
export function pointOf(geo: Geo): LatLng | null {
  const coordinates = geo?.geo_json?.geometry?.coordinates;
  if (!coordinates) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  return { latitude, longitude };
}

type Position = [number, number];

/** The area as polygons of rings, the outer ring first, in Leaflet's latitude-first order. */
export function areaOutlines(area: Area): Position[][][] {
  const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
  return polygons.map((rings) =>
    rings.map((ring) => ring.map(([longitude, latitude]): Position => [latitude, longitude])),
  );
}

// Ray casting: a ray from the point crosses the ring's edges an odd number of times when inside.
function ringContains(ring: Position[], { latitude, longitude }: LatLng): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [latitudeA, longitudeA] = ring[index] ?? [0, 0];
    const [latitudeB, longitudeB] = ring[previous] ?? [0, 0];
    const crosses =
      latitudeA > latitude !== latitudeB > latitude &&
      longitude <
        ((longitudeB - longitudeA) * (latitude - latitudeA)) / (latitudeB - latitudeA) + longitudeA;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

/** Whether the point lies inside the area: inside an outer ring and outside its holes. */
export function areaContains(area: Area, point: LatLng): boolean {
  return areaOutlines(area).some(
    ([outer = [], ...holes]) =>
      ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point)),
  );
}

/** Reads "latitude, longitude", as the field shows it, or null when it is not a valid position. */
export function parsePoint(text: string): LatLng | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match) {
    return null;
  }
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  return { latitude, longitude };
}

/** Past this many corners an outline (one found by name, usually) is redrawn, not dragged. */
const MAX_RESHAPEABLE_CORNERS = 60;

export function canReshape(area: Area): boolean {
  const corners = areaOutlines(area).flat(2).length;
  return corners <= MAX_RESHAPEABLE_CORNERS;
}
