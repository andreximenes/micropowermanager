import type { LatLng } from '@/components/LocationMap';

type Geo =
  | { geo_json?: { geometry?: { coordinates: [number, number] } } | null }
  | null
  | undefined;

/** MPM stores points as GeoJSON, which orders coordinates longitude first. */
export function pointOf(geo: Geo): LatLng | null {
  const coordinates = geo?.geo_json?.geometry?.coordinates;
  if (!coordinates) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  return { latitude, longitude };
}
