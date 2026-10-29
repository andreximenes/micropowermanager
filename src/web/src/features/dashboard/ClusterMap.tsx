import L from 'leaflet';
import { useEffect, useRef } from 'react';

import type { Cluster, MiniGrid } from '@/api/locations';
import type { LatLng } from '@/components/LocationMap';
import { areaOutlines } from '@/lib/geo';
import { openStreetMap } from '@/lib/map';

type View = LatLng & { zoom: number };

const miniGridIcon = L.divIcon({
  className: '',
  html: '<span class="block size-3.5 rounded-full border-2 border-green-bright bg-navy shadow"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * The company's clusters as outlined areas and its mini-grids as points. It frames the
 * clusters; without any it opens on the company's map settings.
 */
export function ClusterMap({
  clusters,
  miniGrids,
  view,
  label,
  className,
}: {
  clusters: Cluster[];
  miniGrids: MiniGrid[];
  view: View | null;
  label: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const map = openStreetMap(container.current);
    const areas = clusters
      .flatMap((cluster) =>
        cluster.geo_json ? [{ cluster, area: cluster.geo_json.geometry }] : [],
      )
      .map(({ cluster, area }) =>
        L.polygon(areaOutlines(area), {
          className: 'fill-teal/30 stroke-navy',
          fillOpacity: 1,
          weight: 2,
          dashArray: '5 4',
        })
          .bindTooltip(cluster.name)
          .addTo(map),
      );
    for (const miniGrid of miniGrids) {
      const coordinates = miniGrid.location?.geo_json?.geometry.coordinates;
      if (coordinates) {
        L.marker([coordinates[1], coordinates[0]], { icon: miniGridIcon, title: miniGrid.name })
          .bindTooltip(miniGrid.name)
          .addTo(map);
      }
    }

    if (areas.length > 0) {
      map.fitBounds(L.featureGroup(areas).getBounds(), { padding: [16, 16] });
    } else if (view) {
      map.setView([view.latitude, view.longitude], view.zoom);
    } else {
      map.fitWorld();
    }
    return () => {
      map.remove();
    };
  }, [clusters, miniGrids, view]);

  // Leaflet layers its panes up to z-index 1000; `isolate` keeps them inside this box.
  return (
    <div ref={container} role="img" aria-label={label} className={`isolate ${className ?? ''}`} />
  );
}
