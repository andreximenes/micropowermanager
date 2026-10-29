import L from 'leaflet';

const plugin = vi.hoisted(() => ({ loads: 0, fail: true }));

vi.mock('@geoman-io/leaflet-geoman-free', () => {
  plugin.loads += 1;
  if (plugin.fail) {
    throw new Error('offline');
  }
  return {};
});
vi.mock('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css', () => ({}));

describe('loadGeoman', () => {
  it('exposes Leaflet globally for the plugin, and retries after a failed load', async () => {
    const { loadGeoman } = await import('./geoman');

    await expect(loadGeoman()).rejects.toThrow();
    expect((window as Window & { L?: unknown }).L).toBe(L);

    plugin.fail = false;
    await expect(loadGeoman()).resolves.toBeUndefined();
    // Later calls share the first successful load.
    await loadGeoman();
    expect(plugin.loads).toBe(2);
  });
});
