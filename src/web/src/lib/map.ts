import L from 'leaflet';

/** A Leaflet map on OpenStreetMap tiles that leaves the page scroll to the page. */
export function openStreetMap(container: HTMLElement): L.Map {
  const map = L.map(container, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  return map;
}
