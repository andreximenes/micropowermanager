import { render, screen } from '@testing-library/react';

import { LocationMap } from './LocationMap';

// Leaflet needs real layout to place tiles and markers, which jsdom does not have.
const leaflet = vi.hoisted(() => {
  const marker = {
    position: { lat: 0, lng: 0 },
    handlers: new Map<string, () => void>(),
    addTo: vi.fn(),
    on: vi.fn(),
    getLatLng: vi.fn(),
  };
  marker.addTo.mockReturnValue(marker);
  marker.on.mockImplementation((event: string, handler: () => void) => {
    marker.handlers.set(event, handler);
    return marker;
  });
  marker.getLatLng.mockImplementation(() => marker.position);
  const map = { setView: vi.fn(), remove: vi.fn() };
  map.setView.mockReturnValue(map);
  const tileLayer = { addTo: vi.fn() };
  return {
    marker,
    map,
    module: {
      divIcon: vi.fn(() => ({ kind: 'pin' })),
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => tileLayer),
      marker: vi.fn(() => marker),
    },
  };
});

vi.mock('leaflet', () => ({ default: leaflet.module }));

beforeEach(() => {
  leaflet.module.map.mockClear();
  leaflet.module.marker.mockClear();
  leaflet.map.setView.mockClear();
  leaflet.map.remove.mockClear();
  leaflet.marker.handlers.clear();
});

const position = { latitude: -6.8, longitude: 39.28 };

describe('LocationMap', () => {
  it('centres a map on the position with a fixed pin', () => {
    render(<LocationMap position={position} label="Customer location" className="h-44" />);

    const container = screen.getByRole('img', { name: 'Customer location' });
    expect(container).toHaveClass('isolate', 'h-44');
    expect(leaflet.module.map).toHaveBeenCalledWith(container, { scrollWheelZoom: false });
    expect(leaflet.map.setView).toHaveBeenCalledWith([-6.8, 39.28], 13);
    expect(leaflet.module.marker).toHaveBeenCalledWith([-6.8, 39.28], {
      icon: { kind: 'pin' },
      draggable: false,
    });
  });

  it('reports where a draggable pin is dropped', () => {
    const onMove = vi.fn();
    render(<LocationMap position={position} label="Pick the site" onMove={onMove} />);

    expect(leaflet.module.marker).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ draggable: true }),
    );
    leaflet.marker.position = { lat: -6.9, lng: 39.3 };
    leaflet.marker.handlers.get('dragend')?.();

    expect(onMove).toHaveBeenCalledWith({ latitude: -6.9, longitude: 39.3 });
  });

  it('reports to the latest callback without rebuilding the map', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<LocationMap position={position} label="Pick" onMove={first} />);

    rerender(<LocationMap position={position} label="Pick" onMove={second} />);
    leaflet.marker.handlers.get('dragend')?.();

    expect(leaflet.module.map).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the map when the position changes and removes it on unmount', () => {
    const { rerender, unmount } = render(<LocationMap position={position} label="Map" />);

    rerender(<LocationMap position={{ latitude: 1, longitude: 2 }} label="Map" />);

    expect(leaflet.map.remove).toHaveBeenCalledTimes(1);
    expect(leaflet.map.setView).toHaveBeenLastCalledWith([1, 2], 13);

    unmount();

    expect(leaflet.map.remove).toHaveBeenCalledTimes(2);
  });
});
