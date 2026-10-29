import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf, paginatorOf } from './schemas';

import type { LatLng } from '@/components/LocationMap';

// GeoJSON orders positions longitude first and may carry an altitude, which is dropped.
const positionSchema = z
  .array(z.number())
  .min(2)
  .transform((position): [number, number] => [position[0] ?? 0, position[1] ?? 0]);
const ringSchema = z.array(positionSchema);

/** A cluster's outline: what the backend stores and what Nominatim returns for a place. */
export const areaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ringSchema)) }),
]);
export type Area = z.infer<typeof areaSchema>;

const pointLocationSchema = z
  .object({
    geo_json: z
      .object({ geometry: z.object({ coordinates: positionSchema }) })
      .nullable()
      .catch(null),
  })
  .nullable()
  .optional();

const clusterSchema = z.object({
  id: z.number(),
  name: z.string(),
  manager_id: z.number().nullable(),
  // Clusters imported without an outline store `{}`; they still list, just without an area.
  geo_json: z.object({ geometry: areaSchema }).nullable().catch(null),
});
export type Cluster = z.infer<typeof clusterSchema>;

export const fetchClusters = async () =>
  (await apiRequest('/clusters', dataOf(z.array(clusterSchema)))).data;

const miniGridSchema = z.object({
  id: z.number(),
  name: z.string(),
  cluster_id: z.number(),
  location: pointLocationSchema,
});
export type MiniGrid = z.infer<typeof miniGridSchema>;

export const fetchMiniGrids = async () =>
  (await apiRequest('/mini-grids', dataOf(z.array(miniGridSchema)))).data;

const villageSchema = z.object({
  id: z.number(),
  name: z.string(),
  mini_grid_id: z.number(),
  country_id: z.number().nullable(),
  location: pointLocationSchema,
});
export type Village = z.infer<typeof villageSchema>;

const VILLAGES_PER_PAGE = 500;

/** Every village: the location tree shows them all, and the list has no filter by site. */
export async function fetchAllVillages(): Promise<Village[]> {
  const villages: Village[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest('/cities', paginatorOf(villageSchema), {
      query: { page, per_page: VILLAGES_PER_PAGE },
    });
    villages.push(...result.data);
    if (page >= result.last_page) {
      return villages;
    }
  }
}

const countrySchema = z.object({ id: z.number(), country_name: z.string() });
export type Country = z.infer<typeof countrySchema>;

export const fetchCountries = async () =>
  (await apiRequest('/countries', dataOf(z.array(countrySchema)))).data;

const feature = (geometry: Area | { type: 'Point'; coordinates: [number, number] }) => ({
  type: 'Feature',
  geometry,
  // The backend keeps `properties` as sent; an object, never an array.
  properties: {},
});

const pointFeature = ({ latitude, longitude }: LatLng) =>
  feature({ type: 'Point', coordinates: [longitude, latitude] });

const saved = dataOf(z.object({ id: z.number() }));
const deleted = z.object({ message: z.string() });

export type ClusterChanges = { name: string; area: Area; managerId: number | null };

const clusterBody = (cluster: ClusterChanges) => ({
  name: cluster.name,
  geo_json: feature(cluster.area),
  ...(cluster.managerId === null ? {} : { manager_id: cluster.managerId }),
});

export const createCluster = async (cluster: ClusterChanges) =>
  (
    await apiRequest('/clusters', saved, {
      method: 'POST',
      body: clusterBody(cluster),
    })
  ).data;

export const updateCluster = async (clusterId: number, cluster: ClusterChanges) =>
  (
    await apiRequest(`/clusters/${clusterId}`, saved, {
      method: 'PUT',
      body: clusterBody(cluster),
    })
  ).data;

export const deleteCluster = (clusterId: number) =>
  apiRequest(`/clusters/${clusterId}`, deleted, { method: 'DELETE' });

export type SiteChanges = { name: string; clusterId: number; point: LatLng };

const siteBody = (site: SiteChanges) => ({
  name: site.name,
  cluster_id: site.clusterId,
  geo_json: pointFeature(site.point),
});

export const createMiniGrid = async (site: SiteChanges) =>
  (await apiRequest('/mini-grids', saved, { method: 'POST', body: siteBody(site) })).data;

export const updateMiniGrid = async (miniGridId: number, site: SiteChanges) =>
  (await apiRequest(`/mini-grids/${miniGridId}`, saved, { method: 'PUT', body: siteBody(site) }))
    .data;

export const deleteMiniGrid = (miniGridId: number) =>
  apiRequest(`/mini-grids/${miniGridId}`, deleted, { method: 'DELETE' });

export type VillageChanges = {
  name: string;
  miniGridId: number;
  countryId: number;
  point: LatLng;
};

const villageBody = (village: VillageChanges) => ({
  name: village.name,
  mini_grid_id: village.miniGridId,
  country_id: village.countryId,
  geo_json: pointFeature(village.point),
});

export const createVillage = async (village: VillageChanges) =>
  (await apiRequest('/cities', saved, { method: 'POST', body: villageBody(village) })).data;

export const updateVillage = async (villageId: number, village: VillageChanges) =>
  (await apiRequest(`/cities/${villageId}`, saved, { method: 'PUT', body: villageBody(village) }))
    .data;

/** Deletes a village, first moving its linked addresses to `reassignTo` when given. */
export const deleteVillage = (villageId: number, reassignTo?: number) =>
  apiRequest(`/cities/${villageId}`, deleted, {
    method: 'DELETE',
    body: reassignTo === undefined ? undefined : { reassign_addresses_to: reassignTo },
  });

const linkedAddressSchema = z.object({
  id: z.number(),
  owner_type: z.string().nullable(),
  owner_name: z.string().nullable(),
});
export type LinkedAddress = z.infer<typeof linkedAddressSchema>;

/** The first few addresses that keep a village from being deleted, and how many there are. */
export const fetchLinkedAddresses = async (villageId: number) => {
  const result = await apiRequest(
    `/cities/${villageId}/addresses`,
    z.object({ data: z.array(linkedAddressSchema), meta: z.object({ total: z.number() }) }),
    { query: { limit: 5 } },
  );
  return { addresses: result.data, total: result.meta.total };
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search.php';
// Nominatim's usage policy allows one request per second per client.
const NOMINATIM_INTERVAL_MS = 1000;
let lastPlaceSearch = 0;

const placesSchema = z.object({
  features: z.array(
    z.object({ properties: z.object({ display_name: z.string() }), geometry: z.unknown() }),
  ),
});

export type Place = { name: string; area: Area };

/** Places whose outline OpenStreetMap knows; points and lines are left out, a cluster needs an area. */
export async function searchPlaces(name: string): Promise<Place[]> {
  const wait = lastPlaceSearch + NOMINATIM_INTERVAL_MS - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastPlaceSearch = Date.now();
  const params = new URLSearchParams({ q: name, polygon_geojson: '1', format: 'geojson' });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed (${response.status})`);
  }
  const parsed = placesSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('OpenStreetMap search sent an unexpected answer');
  }
  return parsed.data.features.flatMap((place) => {
    const area = areaSchema.safeParse(place.geometry);
    return area.success ? [{ name: place.properties.display_name, area: area.data }] : [];
  });
}
