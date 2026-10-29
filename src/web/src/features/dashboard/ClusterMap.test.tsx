import { render, screen } from '@testing-library/react';

import { ClusterMap } from './ClusterMap';

import type { Cluster, MiniGrid } from '@/api/locations';

// Leaflet needs real layout to place tiles and shapes, which jsdom does not have.
const leaflet = vi.hoisted(() => {
  const layer = () => {
    const created = { bindTooltip: vi.fn(), addTo: vi.fn() };
    created.bindTooltip.mockReturnValue(created);
    created.addTo.mockReturnValue(created);
    return created;
  };
  const map = { setView: vi.fn(), fitBounds: vi.fn(), fitWorld: vi.fn(), remove: vi.fn() };
  return {
    map,
    module: {
      divIcon: vi.fn(() => ({ kind: 'mini-grid' })),
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      polygon: vi.fn(layer),
      marker: vi.fn(layer),
      featureGroup: vi.fn(() => ({ getBounds: () => 'bounds' })),
    },
  };
});

vi.mock('leaflet', () => ({ default: leaflet.module }));

beforeEach(() => {
  vi.clearAllMocks();
});

const cluster: Cluster = {
  id: 1,
  name: "Jema'a",
  manager_id: 4,
  geo_json: {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [8.3, 9.5],
          [8.4, 9.6],
        ],
      ],
    },
  },
};
const miniGrid: MiniGrid = {
  id: 2,
  name: 'Kafanchan',
  cluster_id: 1,
  location: { geo_json: { geometry: { coordinates: [8.29, 9.58] } } },
};
const view = { latitude: 9.5, longitude: 8.3, zoom: 7 };

describe('ClusterMap', () => {
  it('outlines clusters, marks mini-grids and frames the clusters', () => {
    render(<ClusterMap clusters={[cluster]} miniGrids={[miniGrid]} view={view} label="Clusters" />);

    expect(screen.getByRole('img', { name: 'Clusters' })).toHaveClass('isolate');
    expect(leaflet.module.polygon).toHaveBeenCalledWith(
      [
        [
          [
            [9.5, 8.3],
            [9.6, 8.4],
          ],
        ],
      ],
      expect.objectContaining({ className: 'fill-teal/30 stroke-navy' }),
    );
    expect(leaflet.module.marker).toHaveBeenCalledWith([9.58, 8.29], {
      icon: { kind: 'mini-grid' },
      title: 'Kafanchan',
    });
    expect(leaflet.map.fitBounds).toHaveBeenCalledWith('bounds', { padding: [16, 16] });
    expect(leaflet.map.setView).not.toHaveBeenCalled();
  });

  it('opens on the map settings when no cluster has an outline', () => {
    render(
      <ClusterMap
        clusters={[{ ...cluster, geo_json: null }]}
        miniGrids={[{ ...miniGrid, location: null }]}
        view={view}
        label="Clusters"
      />,
    );

    expect(leaflet.module.polygon).not.toHaveBeenCalled();
    expect(leaflet.module.marker).not.toHaveBeenCalled();
    expect(leaflet.map.setView).toHaveBeenCalledWith([9.5, 8.3], 7);
  });

  it('shows the world without clusters or map settings, and cleans up', () => {
    const { unmount } = render(
      <ClusterMap clusters={[]} miniGrids={[]} view={null} label="Clusters" />,
    );

    expect(leaflet.map.fitWorld).toHaveBeenCalled();
    unmount();
    expect(leaflet.map.remove).toHaveBeenCalled();
  });
});
