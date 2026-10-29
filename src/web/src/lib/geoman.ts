import L from 'leaflet';

let loading: Promise<void> | undefined;

/**
 * Loads Geoman, the polygon drawing and editing plugin, on first use so it stays out of the
 * main bundle. It is a classic script that extends the global `L`, and only maps created
 * after it loads get its `pm` controls.
 */
export function loadGeoman(): Promise<void> {
  loading ??= (async () => {
    (window as Window & { L?: typeof L }).L = L;
    await Promise.all([
      import('@geoman-io/leaflet-geoman-free'),
      import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'),
    ]);
  })().catch((error: unknown) => {
    // A failed chunk load (a flaky connection) may succeed on the next attempt.
    loading = undefined;
    throw error;
  });
  return loading;
}
