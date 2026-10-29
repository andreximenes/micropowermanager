import { Banner } from '@spark/ui/banner';
import { Button } from '@spark/ui/button';
import { Card } from '@spark/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { ClusterEditor } from './ClusterEditor';
import { MAP_CLASS, MapCard, type LocationsData } from './EditorLayout';
import { LocationTree } from './LocationTree';
import { LocationsMap } from './LocationsMap';
import { SiteEditor, VillageEditor } from './PointEditors';
import type { LocationsSearch } from './search';

import { fetchMapSettings } from '@/api/customers';
import { fetchAllVillages, fetchClusters, fetchMiniGrids } from '@/api/locations';
import { can, readSession } from '@/auth/session';

function Overview({ data }: { data: LocationsData }) {
  return (
    <>
      <MapCard>
        <LocationsMap
          label="Map of all clusters, sites and villages"
          clusters={data.clusters}
          sites={data.sites}
          villages={data.villages}
          frame={null}
          view={data.view}
          className={MAP_CLASS}
        />
      </MapCard>
      <Card className="bg-panel px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
        Pick a cluster, site or village to see it on the map and change it.
      </Card>
    </>
  );
}

function Missing({ what }: { what: string }) {
  return (
    <Banner tone="warning" role="alert">
      That {what} no longer exists.{' '}
      <Link to="/locations" search={{}} className="underline">
        Show all locations
      </Link>
    </Banner>
  );
}

/** The editor for what the URL picks; keyed so switching to another location starts fresh. */
function Editor({
  data,
  search,
  canEdit,
}: {
  data: LocationsData;
  search: LocationsSearch;
  canEdit: boolean;
}) {
  if (search.new === 'cluster' && canEdit) {
    return <ClusterEditor key="new-cluster" data={data} canEdit />;
  }
  if (search.new === 'site' && search.cluster && canEdit) {
    return <SiteEditor key="new-site" data={data} clusterId={search.cluster} canEdit />;
  }
  if (search.new === 'village' && search.site && canEdit) {
    return <VillageEditor key="new-village" data={data} siteId={search.site} canEdit />;
  }
  if (search.village) {
    const village = data.villages.find((candidate) => candidate.id === search.village);
    return village ? (
      <VillageEditor
        key={`village-${village.id}`}
        data={data}
        village={village}
        canEdit={canEdit}
      />
    ) : (
      <Missing what="village" />
    );
  }
  if (search.site) {
    const site = data.sites.find((candidate) => candidate.id === search.site);
    return site ? (
      <SiteEditor key={`site-${site.id}`} data={data} site={site} canEdit={canEdit} />
    ) : (
      <Missing what="site" />
    );
  }
  if (search.cluster) {
    const cluster = data.clusters.find((candidate) => candidate.id === search.cluster);
    return cluster ? (
      <ClusterEditor
        key={`cluster-${cluster.id}`}
        data={data}
        cluster={cluster}
        canEdit={canEdit}
      />
    ) : (
      <Missing what="cluster" />
    );
  }
  return <Overview data={data} />;
}

export function LocationsPage({ search }: { search: LocationsSearch }) {
  const canEdit = can(readSession(), 'settings');
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: fetchClusters });
  const sites = useQuery({ queryKey: ['mini-grids'], queryFn: fetchMiniGrids });
  const villages = useQuery({ queryKey: ['villages'], queryFn: fetchAllVillages });
  const mapSettings = useQuery({ queryKey: ['map-settings'], queryFn: fetchMapSettings });
  const error = clusters.error ?? sites.error ?? villages.error;
  const data: LocationsData | null =
    clusters.data && sites.data && villages.data && !mapSettings.isPending
      ? {
          clusters: clusters.data,
          sites: sites.data,
          villages: villages.data,
          view: mapSettings.data ?? null,
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold">Locations</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            Clusters, sites and villages where customers live
          </p>
        </div>
        {canEdit ? (
          <Button asChild>
            <Link to="/locations" search={{ new: 'cluster' }}>
              + New cluster
            </Link>
          </Button>
        ) : null}
      </div>
      {error ? (
        <Banner tone="error" role="alert">
          Could not load the locations: {error.message}
        </Banner>
      ) : null}
      {!data && !error ? (
        <p className="m-0 py-8 text-center text-sm text-muted-foreground">Loading locations…</p>
      ) : null}
      {data ? (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="bg-panel p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <LocationTree
              clusters={data.clusters}
              sites={data.sites}
              villages={data.villages}
              search={search}
              canEdit={canEdit}
            />
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            <Editor data={data} search={search} canEdit={canEdit} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
