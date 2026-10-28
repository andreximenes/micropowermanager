import L from 'leaflet';
import { useEffect, useRef } from 'react';

export type LatLng = { latitude: number; longitude: number };

type LocationMapProps = {
  position: LatLng;
  label: string;
  /** When set, the pin can be dragged and reports its new position. */
  onMove?: (position: LatLng) => void;
  className?: string;
};

const pinIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:16px;height:16px;border-radius:50%;background:var(--navy);border:3px solid var(--green-bright);box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** A map that stays inside its own box: no floating layers outside the page flow. */
export function LocationMap({ position, label, onMove, className }: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const map = L.map(container.current, { scrollWheelZoom: false }).setView(
      [position.latitude, position.longitude],
      13,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const marker = L.marker([position.latitude, position.longitude], {
      icon: pinIcon,
      draggable: Boolean(onMoveRef.current),
    }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onMoveRef.current?.({ latitude: lat, longitude: lng });
    });
    return () => {
      map.remove();
    };
  }, [position.latitude, position.longitude]);

  // Leaflet layers its panes up to z-index 1000; `isolate` keeps them inside this box
  // so the map never paints over dialogs, sheets or menus.
  return <div ref={container} role="img" aria-label={label} className={`isolate ${className ?? ''}`} />;
}
