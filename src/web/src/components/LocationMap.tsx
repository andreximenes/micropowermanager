import L from 'leaflet';
import { useEffect, useRef } from 'react';

import { openStreetMap } from '@/lib/map';

export type LatLng = { latitude: number; longitude: number };

type LocationMapProps = {
  position: LatLng;
  label: string;
  /** When set, the pin can be dragged, or dropped by clicking the map, and reports its new position. */
  onMove?: (position: LatLng) => void;
  zoom?: number;
  /** When set, reports the zoom the viewer picked with the map's own controls. */
  onZoom?: (zoom: number) => void;
  className?: string;
};

const pinIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:var(--navy);border:3px solid var(--green-bright);box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** A map that stays inside its own box: no floating layers outside the page flow. */
export function LocationMap({
  position,
  label,
  onMove,
  zoom = 13,
  onZoom,
  className,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    onMoveRef.current = onMove;
    onZoomRef.current = onZoom;
  }, [onMove, onZoom]);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const map = openStreetMap(container.current).setView(
      [position.latitude, position.longitude],
      zoom,
    );
    const marker = L.marker([position.latitude, position.longitude], {
      icon: pinIcon,
      draggable: Boolean(onMoveRef.current),
    }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onMoveRef.current?.({ latitude: lat, longitude: lng });
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      onMoveRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    map.on('zoomend', () => onZoomRef.current?.(map.getZoom()));
    return () => {
      map.remove();
    };
  }, [position.latitude, position.longitude, zoom]);

  // Leaflet layers its panes up to z-index 1000; `isolate` keeps them inside this box
  // so the map never paints over dialogs, sheets or menus.
  return (
    <div ref={container} role="img" aria-label={label} className={`isolate ${className ?? ''}`} />
  );
}
