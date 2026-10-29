import type {} from '@geoman-io/leaflet-geoman-free';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import { areaSchema, type Area, type Cluster, type MiniGrid, type Village } from '@/api/locations';
import type { LatLng } from '@/components/LocationMap';
import { areaOutlines, canReshape, pointOf } from '@/lib/geo';
import { loadGeoman } from '@/lib/geoman';
import { openStreetMap } from '@/lib/map';

export type MapView = LatLng & { zoom: number };

/** Where the map looks: an area to fit, a point to centre on, or everything when null. */
export type Frame = { area: Area } | { point: LatLng } | null;

export type AreaDraft = {
  value: Area | null;
  /** True while the user draws a new outline by clicking points. */
  drawing: boolean;
  onChange: (area: Area) => void;
  onDrawingEnd: () => void;
};

export type PointDraft = { value: LatLng | null; onChange: (point: LatLng) => void };

type LocationsMapProps = {
  label: string;
  clusters: Cluster[];
  sites: MiniGrid[];
  villages: Village[];
  /** The cluster, site or village being edited; the draft draws it instead. */
  hidden?: { kind: 'cluster' | 'site' | 'village'; id: number };
  highlightedClusterId?: number;
  frame: Frame;
  view: MapView | null;
  area?: AreaDraft;
  point?: PointDraft;
  className?: string;
};

const dot = (size: number, classes: string) =>
  L.divIcon({
    className: '',
    html: `<span class="block rounded-full shadow ${classes}" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const siteIcon = dot(14, 'border-2 border-green-bright bg-navy');
const villageIcon = dot(10, 'border-2 border-navy bg-panel');
const draftIcon = dot(18, 'border-[3px] border-green-bright bg-navy');

const toLatLng = ({ lat, lng }: L.LatLng): LatLng => ({ latitude: lat, longitude: lng });

function areaOf(layer: L.Polygon): Area | null {
  const parsed = areaSchema.safeParse(layer.toGeoJSON().geometry);
  return parsed.success ? parsed.data : null;
}

function fit(map: L.Map, frame: Frame, clusters: Cluster[], view: MapView | null) {
  if (frame && 'point' in frame) {
    map.setView([frame.point.latitude, frame.point.longitude], 13);
    return;
  }
  const areas = frame
    ? [frame.area]
    : clusters.flatMap((cluster) => cluster.geo_json?.geometry ?? []);
  if (areas.length > 0) {
    map.fitBounds(L.latLngBounds(areas.flatMap((area) => areaOutlines(area).flat(2))), {
      padding: [16, 16],
    });
  } else if (view) {
    map.setView([view.latitude, view.longitude], view.zoom);
  } else {
    map.fitWorld();
  }
}

/**
 * Clusters as outlined areas, sites and villages as points, plus the one being edited: an
 * outline drawn or reshaped with Geoman, or a pin placed by clicking or dragging.
 */
export function LocationsMap({
  label,
  clusters,
  sites,
  villages,
  hidden,
  highlightedClusterId,
  frame,
  view,
  area,
  point,
  className,
}: LocationsMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [toolsFailed, setToolsFailed] = useState(false);
  const needsTools = area !== undefined;

  // Drafts report changes through refs, so a new callback each render does not rebuild layers.
  const areaChange = useRef(area?.onChange);
  const drawingEnd = useRef(area?.onDrawingEnd);
  const pointChange = useRef(point?.onChange);
  useEffect(() => {
    areaChange.current = area?.onChange;
    drawingEnd.current = area?.onDrawingEnd;
    pointChange.current = point?.onChange;
  });

  useEffect(() => {
    let created: L.Map | undefined;
    let cancelled = false;
    const tools = needsTools ? loadGeoman().catch(() => setToolsFailed(true)) : Promise.resolve();
    void tools.then(() => {
      if (cancelled || !container.current) {
        return;
      }
      created = openStreetMap(container.current);
      setMap(created);
    });
    return () => {
      cancelled = true;
      created?.remove();
      setMap(null);
    };
  }, [needsTools]);

  const frameKey = JSON.stringify(frame);
  useEffect(() => {
    if (map) {
      fit(map, JSON.parse(frameKey) as Frame, clusters, view);
    }
    // Only a new frame moves the map; data refreshing underneath must not pull it away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, frameKey]);

  useEffect(() => {
    if (!map) {
      return;
    }
    const isHidden = (kind: string, id: number) => hidden?.kind === kind && hidden.id === id;
    const layers = L.featureGroup().addTo(map);
    for (const cluster of clusters) {
      if (!cluster.geo_json || isHidden('cluster', cluster.id)) {
        continue;
      }
      const highlighted = cluster.id === highlightedClusterId;
      L.polygon(areaOutlines(cluster.geo_json.geometry), {
        className: highlighted ? 'fill-teal/30 stroke-navy' : 'fill-teal/10 stroke-navy/50',
        fillOpacity: 1,
        weight: 2,
        dashArray: '5 4',
        pmIgnore: true,
      })
        .bindTooltip(cluster.name)
        .addTo(layers);
    }
    const points = [
      ...sites.map((site) => ({ kind: 'site', item: site, icon: siteIcon })),
      ...villages.map((village) => ({ kind: 'village', item: village, icon: villageIcon })),
    ];
    for (const { kind, item, icon } of points) {
      const position = pointOf(item.location);
      if (!position || isHidden(kind, item.id)) {
        continue;
      }
      L.marker([position.latitude, position.longitude], { icon, title: item.name, pmIgnore: true })
        .bindTooltip(item.name)
        .addTo(layers);
    }
    return () => {
      layers.remove();
    };
  }, [map, clusters, sites, villages, hidden?.kind, hidden?.id, highlightedClusterId]);

  const areaValue = area?.value ?? null;
  useEffect(() => {
    if (!map || !areaValue) {
      return;
    }
    const outline = L.polygon(areaOutlines(areaValue), {
      className: 'fill-green-bright/20 stroke-green',
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);
    if (canReshape(areaValue)) {
      outline.pm?.enable({ allowSelfIntersection: false });
    }
    outline.on('pm:edit', () => {
      const edited = areaOf(outline);
      if (edited) {
        areaChange.current?.(edited);
      }
    });
    return () => {
      outline.remove();
    };
  }, [map, areaValue]);

  const drawing = area?.drawing ?? false;
  useEffect(() => {
    if (!map?.pm || !drawing) {
      return;
    }
    const created = ({ layer }: { layer: L.Layer }) => {
      layer.remove();
      const drawn = layer instanceof L.Polygon ? areaOf(layer) : null;
      if (drawn) {
        areaChange.current?.(drawn);
      }
    };
    const ended = () => drawingEnd.current?.();
    map.on('pm:create', created);
    map.on('pm:drawend', ended);
    map.pm.enableDraw('Polygon', { continueDrawing: false });
    return () => {
      map.off('pm:create', created);
      map.off('pm:drawend', ended);
      map.pm.disableDraw();
    };
  }, [map, drawing]);

  const placing = point !== undefined;
  const pointValue = point?.value ?? null;
  useEffect(() => {
    if (!map || !placing) {
      return;
    }
    const clicked = (event: L.LeafletMouseEvent) => pointChange.current?.(toLatLng(event.latlng));
    map.on('click', clicked);
    const pin = pointValue
      ? L.marker([pointValue.latitude, pointValue.longitude], {
          icon: draftIcon,
          draggable: true,
          pmIgnore: true,
        }).addTo(map)
      : null;
    pin?.on('dragend', () => pointChange.current?.(toLatLng(pin.getLatLng())));
    return () => {
      map.off('click', clicked);
      pin?.remove();
    };
  }, [map, placing, pointValue]);

  return (
    <div className="flex flex-col gap-2">
      {toolsFailed ? (
        <p role="alert" className="m-0 text-sm text-red">
          The drawing tools did not load. Reload the page, or find the area by name.
        </p>
      ) : null}
      {/* Leaflet layers its panes up to z-index 1000; `isolate` keeps them inside this box. */}
      <div ref={container} role="img" aria-label={label} className={`isolate ${className ?? ''}`} />
    </div>
  );
}
