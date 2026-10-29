import { render, screen } from '@testing-library/react';

import { LocationsMap } from './LocationsMap';

import type { Area, Cluster, MiniGrid, Village } from '@/api/locations';
import { geoAt } from '@/test/fixtures';

type Handler = (event?: unknown) => void;

// Leaflet needs real layout to place tiles and shapes, which jsdom does not have.
const leaflet = vi.hoisted(() => {
  const layers: (Record<string, unknown> & { handlers: Map<string, Handler> })[] = [];
  function makeLayer(kind: string, prototype: object = {}) {
    const handlers = new Map<string, Handler>();
    const layer: Record<string, unknown> & { handlers: Map<string, Handler> } = Object.assign(
      Object.create(prototype) as object,
      {
        kind,
        handlers,
        addTo: vi.fn(() => layer),
        bindTooltip: vi.fn(() => layer),
        remove: vi.fn(),
        on: vi.fn((event: string, handler: Handler) => {
          handlers.set(event, handler);
          return layer;
        }),
        pm: { enable: vi.fn() },
        toGeoJSON: vi.fn(),
        getLatLng: vi.fn(),
      },
    );
    layers.push(layer);
    return layer;
  }
  class Polygon {
    readonly shape = 'polygon';
  }
  const mapHandlers = new Map<string, Handler>();
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    fitWorld: vi.fn(),
    remove: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => mapHandlers.set(event, handler)),
    off: vi.fn((event: string) => mapHandlers.delete(event)),
    pm: { enableDraw: vi.fn(), disableDraw: vi.fn() },
  };
  return {
    layers,
    map,
    mapHandlers,
    makeLayer,
    module: {
      Polygon,
      divIcon: vi.fn(() => ({})),
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      polygon: vi.fn((outline: unknown, options: unknown) =>
        Object.assign(makeLayer('polygon', Polygon.prototype), { outline, options }),
      ),
      marker: vi.fn((position: unknown, options: unknown) =>
        Object.assign(makeLayer('marker'), { position, options }),
      ),
      featureGroup: vi.fn(() => makeLayer('group')),
      latLngBounds: vi.fn((points: unknown) => ({ points })),
    },
  };
});

vi.mock('leaflet', () => ({ default: leaflet.module }));

const geoman = vi.hoisted(() => ({ loadGeoman: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/geoman', () => geoman);

const square: Area = {
  type: 'Polygon',
  coordinates: [
    [
      [8, 9],
      [9, 9],
      [9, 10],
      [8, 9],
    ],
  ],
};
const clusters: Cluster[] = [
  { id: 1, name: "Jema'a", manager_id: 4, geo_json: { geometry: square } },
  { id: 2, name: 'Empty', manager_id: 4, geo_json: null },
];
const sites: MiniGrid[] = [
  { id: 3, name: 'Kafanchan', cluster_id: 1, location: geoAt(9.5, 8.5) },
  { id: 4, name: 'Nowhere', cluster_id: 1, location: null },
];
const villages: Village[] = [
  { id: 5, name: 'Kafanchan North', mini_grid_id: 3, country_id: 1, location: geoAt(9.6, 8.6) },
];
const context = { clusters, sites, villages, view: null };

const created = (kind: string) => leaflet.layers.filter((layer) => layer.kind === kind);
const mapReady = () => vi.waitFor(() => expect(leaflet.module.map).toHaveBeenCalled());

beforeEach(() => {
  vi.clearAllMocks();
  leaflet.layers.length = 0;
  leaflet.mapHandlers.clear();
  geoman.loadGeoman.mockImplementation(() => Promise.resolve());
});

describe('LocationsMap', () => {
  it('outlines clusters, marks sites and villages, and frames every cluster', async () => {
    render(<LocationsMap label="Locations" {...context} frame={null} highlightedClusterId={1} />);
    await mapReady();

    expect(screen.getByRole('img', { name: 'Locations' })).toHaveClass('isolate');
    expect(leaflet.module.polygon).toHaveBeenCalledTimes(1);
    expect(leaflet.module.polygon).toHaveBeenCalledWith(
      [
        [
          [
            [9, 8],
            [9, 9],
            [10, 9],
            [9, 8],
          ],
        ],
      ],
      expect.objectContaining({ className: 'fill-teal/30 stroke-navy' }),
    );
    expect(created('marker').map((marker) => marker.position)).toEqual([
      [9.5, 8.5],
      [9.6, 8.6],
    ]);
    expect(leaflet.map.fitBounds).toHaveBeenCalledWith(
      {
        points: [
          [9, 8],
          [9, 9],
          [10, 9],
          [9, 8],
        ],
      },
      { padding: [16, 16] },
    );
    expect(geoman.loadGeoman).not.toHaveBeenCalled();
  });

  it('leaves out what is being edited and centres on a point', async () => {
    render(
      <LocationsMap
        label="Site"
        {...context}
        hidden={{ kind: 'site', id: 3 }}
        frame={{ point: { latitude: 9.5, longitude: 8.5 } }}
      />,
    );
    await mapReady();

    expect(created('marker')).toHaveLength(1);
    expect(leaflet.map.setView).toHaveBeenCalledWith([9.5, 8.5], 13);
  });

  it('falls back to the map settings, then to the world', async () => {
    const empty = { clusters: [], sites: [], villages: [] };
    const { unmount } = render(
      <LocationsMap
        label="Map"
        {...empty}
        frame={null}
        view={{ latitude: 1, longitude: 2, zoom: 7 }}
      />,
    );
    await mapReady();
    expect(leaflet.map.setView).toHaveBeenCalledWith([1, 2], 7);
    unmount();
    expect(leaflet.map.remove).toHaveBeenCalled();

    render(<LocationsMap label="Map" {...empty} frame={null} view={null} />);
    await vi.waitFor(() => expect(leaflet.map.fitWorld).toHaveBeenCalled());
  });

  it('draws a new area and reshapes it with Geoman', async () => {
    const onChange = vi.fn();
    const onDrawingEnd = vi.fn();
    const draft = { value: null, drawing: true, onChange, onDrawingEnd };
    const { rerender } = render(
      <LocationsMap label="Cluster" {...context} frame={null} area={draft} />,
    );
    await mapReady();
    expect(geoman.loadGeoman).toHaveBeenCalled();
    expect(leaflet.map.pm.enableDraw).toHaveBeenCalledWith('Polygon', { continueDrawing: false });

    const drawn = leaflet.module.polygon([], {});
    drawn.toGeoJSON = vi.fn(() => ({ geometry: square }));
    leaflet.mapHandlers.get('pm:create')?.({ layer: drawn });
    expect(drawn.remove).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(square);
    leaflet.mapHandlers.get('pm:drawend')?.();
    expect(onDrawingEnd).toHaveBeenCalled();

    rerender(
      <LocationsMap
        label="Cluster"
        {...context}
        frame={null}
        area={{ ...draft, value: square, drawing: false }}
      />,
    );
    expect(leaflet.map.pm.disableDraw).toHaveBeenCalled();
    const outline = created('polygon').at(-1);
    expect(outline?.pm).toMatchObject({ enable: expect.any(Function) });
    const reshaped: Area = {
      ...square,
      coordinates: [
        [
          [8, 9],
          [9.5, 9],
          [9, 10],
          [8, 9],
        ],
      ],
    };
    (outline?.toGeoJSON as ReturnType<typeof vi.fn>).mockReturnValue({ geometry: reshaped });
    outline?.handlers.get('pm:edit')?.();
    expect(onChange).toHaveBeenLastCalledWith(reshaped);
  });

  it('places a pin by clicking and moves it by dragging', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LocationsMap label="Village" {...context} frame={null} point={{ value: null, onChange }} />,
    );
    await mapReady();
    leaflet.mapHandlers.get('click')?.({ latlng: { lat: 9.1, lng: 8.2 } });
    expect(onChange).toHaveBeenCalledWith({ latitude: 9.1, longitude: 8.2 });

    rerender(
      <LocationsMap
        label="Village"
        {...context}
        frame={null}
        point={{ value: { latitude: 9.1, longitude: 8.2 }, onChange }}
      />,
    );
    const pin = created('marker').find((marker) => marker.position?.toString() === '9.1,8.2');
    (pin?.getLatLng as ReturnType<typeof vi.fn>).mockReturnValue({ lat: 9.2, lng: 8.3 });
    pin?.handlers.get('dragend')?.();
    expect(onChange).toHaveBeenLastCalledWith({ latitude: 9.2, longitude: 8.3 });
  });

  it('still shows the map when the drawing tools fail to load', async () => {
    geoman.loadGeoman.mockImplementation(() => Promise.reject(new Error('offline')));
    render(
      <LocationsMap
        label="Cluster"
        {...context}
        frame={null}
        area={{ value: null, drawing: false, onChange: vi.fn(), onDrawingEnd: vi.fn() }}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('The drawing tools did not load.');
    await mapReady();
  });
});
