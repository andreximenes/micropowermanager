import { Input } from '@spark/ui/input';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { LocationsSearch } from './search';

import type { Cluster, MiniGrid, Village } from '@/api/locations';
import { plural } from '@/lib/format';

type LocationTreeProps = {
  clusters: Cluster[];
  sites: MiniGrid[];
  villages: Village[];
  search: LocationsSearch;
  canEdit: boolean;
};

const matches = (name: string, filter: string) => name.toLowerCase().includes(filter);

function Toggle({ open, name, onToggle }: { open: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} what is in ${name}`}
      onClick={onToggle}
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-panel-2"
    >
      <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
  );
}

function Row({
  selected,
  search,
  toggle,
  children,
  detail,
}: {
  selected: boolean;
  search: LocationsSearch;
  toggle?: ReactNode;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md pr-2 ${selected ? 'bg-panel-2' : 'hover:bg-panel-2/60'}`}
    >
      {toggle ?? <span className="size-7 shrink-0" />}
      <Link
        to="/locations"
        search={search}
        // Current only for exactly this location, not for the clusters and sites above it.
        activeOptions={{ exact: true, includeSearch: true }}
        className="flex min-w-0 flex-1 items-baseline gap-2 py-1.5 text-sm"
      >
        <span className="min-w-0 truncate">{children}</span>{' '}
        {detail ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </Link>
    </div>
  );
}

function AddLink({ search, children }: { search: LocationsSearch; children: ReactNode }) {
  return (
    <Link
      to="/locations"
      search={search}
      className="ml-8 block rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-panel-2 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

/** Clusters hold sites, sites hold villages. Picking one opens it next to the tree. */
export function LocationTree({ clusters, sites, villages, search, canEdit }: LocationTreeProps) {
  const [filterText, setFilterText] = useState('');
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const filter = filterText.trim().toLowerCase();

  const villagesOf = (siteId: number) =>
    villages.filter((village) => village.mini_grid_id === siteId);
  const sitesOf = (clusterId: number) => sites.filter((site) => site.cluster_id === clusterId);

  const villageShown = (village: Village) => !filter || matches(village.name, filter);
  const siteShown = (site: MiniGrid) =>
    !filter || matches(site.name, filter) || villagesOf(site.id).some(villageShown);
  const clusterShown = (cluster: Cluster) =>
    !filter || matches(cluster.name, filter) || sitesOf(cluster.id).some(siteShown);

  // A filter opens everything it matches; otherwise the path to the selection is open.
  const isOpen = (key: string, onSelectedPath: boolean) =>
    toggled[key] ?? (Boolean(filter) || onSelectedPath);
  const flip = (key: string, open: boolean) =>
    setToggled((current) => ({ ...current, [key]: !open }));

  const shownClusters = clusters.filter(clusterShown);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Filter locations"
          placeholder="Filter by name"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          className="h-10 pl-9"
        />
      </label>
      {shownClusters.length === 0 ? (
        <p className="m-0 px-2 py-4 text-center text-sm text-muted-foreground">
          {filter ? 'Nothing matches that name.' : 'No clusters yet.'}
        </p>
      ) : null}
      <ul aria-label="Clusters" className="m-0 flex list-none flex-col gap-0.5 p-0">
        {shownClusters.map((cluster) => {
          const clusterKey = `cluster-${cluster.id}`;
          const clusterOpen = isOpen(clusterKey, search.cluster === cluster.id);
          const clusterSites = sitesOf(cluster.id);
          return (
            <li key={cluster.id}>
              <Row
                selected={search.cluster === cluster.id && !search.site && !search.new}
                search={{ cluster: cluster.id }}
                detail={plural(clusterSites.length, 'site')}
                toggle={
                  <Toggle
                    open={clusterOpen}
                    name={cluster.name}
                    onToggle={() => flip(clusterKey, clusterOpen)}
                  />
                }
              >
                <strong>{cluster.name}</strong>
              </Row>
              {clusterOpen ? (
                <ul aria-label={`Sites in ${cluster.name}`} className="m-0 list-none pl-5">
                  {clusterSites.filter(siteShown).map((site) => {
                    const siteKey = `site-${site.id}`;
                    const siteOpen = isOpen(siteKey, search.site === site.id);
                    const siteVillages = villagesOf(site.id);
                    return (
                      <li key={site.id}>
                        <Row
                          selected={search.site === site.id && !search.village && !search.new}
                          search={{ cluster: cluster.id, site: site.id }}
                          detail={plural(siteVillages.length, 'village')}
                          toggle={
                            <Toggle
                              open={siteOpen}
                              name={site.name}
                              onToggle={() => flip(siteKey, siteOpen)}
                            />
                          }
                        >
                          {site.name}
                        </Row>
                        {siteOpen ? (
                          <ul
                            aria-label={`Villages in ${site.name}`}
                            className="m-0 list-none pl-5"
                          >
                            {siteVillages.filter(villageShown).map((village) => (
                              <li key={village.id}>
                                <Row
                                  selected={search.village === village.id && !search.new}
                                  search={{
                                    cluster: cluster.id,
                                    site: site.id,
                                    village: village.id,
                                  }}
                                >
                                  {village.name}
                                </Row>
                              </li>
                            ))}
                            {canEdit ? (
                              <li>
                                <AddLink
                                  search={{ cluster: cluster.id, site: site.id, new: 'village' }}
                                >
                                  + Add village
                                </AddLink>
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                  {canEdit ? (
                    <li>
                      <AddLink search={{ cluster: cluster.id, new: 'site' }}>+ Add site</AddLink>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
