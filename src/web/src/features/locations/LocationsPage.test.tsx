import { cleanup, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { geoAt, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

// Leaflet cannot lay out in jsdom; the stand-in exposes what the map hands back to the editors.
vi.mock('./LocationsMap', () => ({
  LocationsMap: ({
    label,
    frame,
    area,
    point,
  }: {
    label: string;
    frame: unknown;
    area?: { drawing: boolean; onChange: (area: unknown) => void; onDrawingEnd: () => void };
    point?: { onChange: (point: { latitude: number; longitude: number }) => void };
  }) => (
    <div role="img" aria-label={label} data-frame={JSON.stringify(frame)}>
      {area ? (
        <button
          type="button"
          onClick={() =>
            area.onChange({
              type: 'Polygon',
              coordinates: [
                [
                  [8, 9],
                  [9, 9],
                  [9, 10],
                  [8, 9],
                ],
              ],
            })
          }
        >
          Map: draw
        </button>
      ) : null}
      {area?.drawing ? (
        <button type="button" onClick={area.onDrawingEnd}>
          Map: finish drawing
        </button>
      ) : null}
      {point ? (
        <>
          <button type="button" onClick={() => point.onChange({ latitude: 9.3, longitude: 8.2 })}>
            Map: click inside
          </button>
          <button type="button" onClick={() => point.onChange({ latitude: 20, longitude: 20 })}>
            Map: click outside
          </button>
        </>
      ) : null}
    </div>
  ),
}));

const square = {
  type: 'Polygon',
  coordinates: [
    [
      [8, 9],
      [9, 9],
      [9, 10],
      [8, 10],
      [8, 9],
    ],
  ],
};

const clusters = [
  {
    id: 1,
    name: 'Southern Kaduna',
    manager_id: 2,
    geo_json: { type: 'Feature', geometry: square },
  },
  { id: 2, name: 'Plateau South', manager_id: 2, geo_json: [] },
];
const sites = [
  { id: 3, name: "Jema'a site", cluster_id: 1, location: geoAt(9.5, 8.5) },
  { id: 4, name: 'Zangon site', cluster_id: 1, location: geoAt(9.6, 8.6) },
];
const villages = [
  { id: 5, name: 'Kafanchan', mini_grid_id: 3, country_id: 7, location: geoAt(9.55, 8.55) },
  { id: 6, name: 'Kafanchan North', mini_grid_id: 3, country_id: 7, location: geoAt(9.56, 8.56) },
];

type Request = { method: string; path: string; body: unknown };

function serveLocations({ usersStatus = 200 }: { usersStatus?: number } = {}) {
  const requests: Request[] = [];
  const record = async (request: globalThis.Request, body = true) => {
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: body ? await request.json().catch(() => undefined) : undefined,
    });
  };
  server.use(
    http.get('/api/clusters', () => HttpResponse.json({ data: clusters })),
    http.get('/api/mini-grids', () => HttpResponse.json({ data: sites })),
    http.get('/api/cities', ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (params.has('term')) {
        return HttpResponse.json({
          data: villages,
          current_page: 1,
          last_page: 1,
          per_page: 30,
          total: 2,
          from: 1,
          to: 2,
        });
      }
      // Two pages, as a tenant with many villages would send them.
      const page = Number(params.get('page'));
      return HttpResponse.json({
        data: [villages[page - 1]],
        current_page: page,
        last_page: 2,
        per_page: 500,
        total: 2,
        from: page,
        to: page,
      });
    }),
    http.get('/api/countries', () =>
      HttpResponse.json({
        data: [
          { id: 7, country_name: 'Nigeria' },
          { id: 8, country_name: 'Ghana' },
        ],
      }),
    ),
    http.get('/api/users', ({ request }) => {
      if (usersStatus !== 200) {
        return HttpResponse.json({ message: 'Forbidden' }, { status: usersStatus });
      }
      const page = Number(new URL(request.url).searchParams.get('page'));
      const user =
        page === 1
          ? { id: 1, name: 'Grace Admin', email: 'grace@example.com' }
          : { id: 2, name: 'Musa Manager', email: 'musa@example.com' };
      return HttpResponse.json({
        data: [{ ...user, roles: ['admin'], address_details: [] }],
        meta: { current_page: page, last_page: 2 },
      });
    }),
    http.post('/api/clusters', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 9 } });
    }),
    http.put('/api/clusters/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 1 } });
    }),
    http.delete('/api/clusters/:id', async ({ request }) => {
      await record(request, false);
      return HttpResponse.json({ message: 'Cluster deleted.' });
    }),
    http.post('/api/mini-grids', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 10 } }, { status: 201 });
    }),
    http.put('/api/mini-grids/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 4 } });
    }),
    http.delete('/api/mini-grids/:id', async ({ request }) => {
      await record(request, false);
      return HttpResponse.json({ message: 'Mini-grid deleted.' });
    }),
    http.post('/api/cities', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 11 } }, { status: 201 });
    }),
    http.put('/api/cities/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 6 } });
    }),
    http.delete('/api/cities/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ message: 'Village deleted.' });
    }),
    http.get('/api/cities/:id/addresses', ({ params }) =>
      HttpResponse.json({
        data:
          params.id === '6'
            ? [{ id: 1, owner_type: 'person', owner_name: 'Amina Okafor', phone: null }]
            : [],
        meta: { total: params.id === '6' ? 3 : 0 },
      }),
    ),
  );
  return requests;
}

const pointFeature = (latitude: number, longitude: number) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [longitude, latitude] },
  properties: {},
});

const editor = async (name: string) => within(await screen.findByRole('region', { name }));

describe('LocationsPage', () => {
  it('shows the tree, opens down to what is picked and filters by name', async () => {
    signIn();
    serveLocations();
    const { user, router } = renderApp('/locations?cluster=1&site=3');

    expect(await screen.findByRole('link', { name: "Jema'a site 2 villages" })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Southern Kaduna 2 sites' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Kafanchan North' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plateau South 0 sites' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide what is in Southern Kaduna' }));
    expect(screen.queryByRole('link', { name: 'Kafanchan North' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Filter locations'), 'north');
    expect(screen.queryByRole('link', { name: 'Plateau South 0 sites' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show what is in Southern Kaduna' }));
    await user.click(screen.getByRole('link', { name: 'Kafanchan North' }));
    expect(router.state.location.search).toEqual({ cluster: 1, site: 3, village: 6 });
    await user.type(screen.getByLabelText('Filter locations'), 'zzz');
    expect(screen.getByText('Nothing matches that name.')).toBeInTheDocument();
  });

  it('adds a cluster with a drawn area and a manager', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations');

    await user.click(await screen.findByRole('link', { name: '+ New cluster' }));
    const form = await editor('New cluster');
    await user.type(form.getByLabelText('Name *'), 'Plateau North');
    await vi.waitFor(() => expect(form.getByLabelText('Manager *')).toBeEnabled());
    await user.selectOptions(form.getByLabelText('Manager *'), 'Musa Manager');
    await user.click(form.getByRole('button', { name: 'Add cluster' }));
    expect(await screen.findByText("Draw the cluster's area or find it by name.")).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Draw area' }));
    expect(screen.getByRole('button', { name: 'Draw area' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Map: draw' }));
    await user.click(screen.getByRole('button', { name: 'Map: finish drawing' }));
    expect(screen.getByRole('button', { name: 'Draw again' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(form.getByRole('button', { name: 'Add cluster' }));

    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 9 }));
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/clusters',
        body: {
          name: 'Plateau North',
          manager_id: 2,
          geo_json: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [8, 9],
                  [9, 9],
                  [9, 10],
                  [8, 9],
                ],
              ],
            },
            properties: {},
          },
        },
      },
    ]);
  });

  it('uses a place outline found on OpenStreetMap, and the signed-in user without a user list', async () => {
    signIn();
    const requests = serveLocations({ usersStatus: 403 });
    const searched: string[] = [];
    server.use(
      http.get('https://nominatim.openstreetmap.org/search.php', ({ request }) => {
        searched.push(new URL(request.url).search);
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              properties: { display_name: 'Jos town' },
              geometry: { type: 'Point', coordinates: [8.9, 9.9] },
            },
            { properties: { display_name: 'Jos North, Plateau' }, geometry: square },
          ],
        });
      }),
    );
    const { user, router } = renderApp('/locations?new=cluster');

    const form = await editor('New cluster');
    expect(await form.findByText(/You'll manage this cluster/)).toBeInTheDocument();
    await user.type(form.getByLabelText('Name *'), 'Jos');
    await user.type(screen.getByLabelText('Search a place by name'), 'Jos North');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    const places = await screen.findByRole('list', { name: 'Places found' });
    expect(within(places).getAllByRole('button')).toHaveLength(1);
    await user.click(within(places).getByRole('button', { name: 'Jos North, Plateau' }));
    expect(screen.getByRole('img', { name: 'Map for the new cluster' })).toHaveAttribute(
      'data-frame',
      JSON.stringify({ area: square }),
    );
    await user.click(form.getByRole('button', { name: 'Add cluster' }));

    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 9 }));
    expect(searched).toEqual(['?q=Jos+North&polygon_geojson=1&format=geojson']);
    expect(requests[0]?.body).toMatchObject({ name: 'Jos', manager_id: 1 });
  });

  it('explains when OpenStreetMap has no outline or cannot be reached', async () => {
    signIn();
    serveLocations();
    let reachable = true;
    server.use(
      http.get('https://nominatim.openstreetmap.org/search.php', () =>
        reachable
          ? HttpResponse.json({ type: 'FeatureCollection', features: [] })
          : HttpResponse.json({}, { status: 503 }),
      ),
    );
    const { user } = renderApp('/locations?new=cluster');

    await user.type(await screen.findByLabelText('Search a place by name'), 'Atlantis');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByText(/OpenStreetMap has no outline for that name/)).toBeVisible();
    reachable = false;
    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByText('OpenStreetMap search failed (503)')).toBeVisible();
  });

  it('renames a cluster and deletes one without sites', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1');

    const form = await editor('Edit cluster · Southern Kaduna');
    expect(await form.findByText('Delete its 2 sites first.')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Delete cluster' })).toBeDisabled();
    await vi.waitFor(() => expect(form.getByLabelText('Manager *')).toHaveValue('2'));
    await user.clear(form.getByLabelText('Name *'));
    await user.type(form.getByLabelText('Name *'), 'Kaduna South');
    await user.click(form.getByRole('button', { name: 'Save cluster' }));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      method: 'PUT',
      path: '/api/clusters/1',
      body: { name: 'Kaduna South', manager_id: 2, geo_json: { geometry: square } },
    });

    await user.click(screen.getByRole('link', { name: 'Plateau South 0 sites' }));
    const empty = await editor('Edit cluster · Plateau South');
    await user.click(empty.getByRole('button', { name: 'Delete cluster' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete cluster' }));
    await vi.waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(requests[1]).toMatchObject({ method: 'DELETE', path: '/api/clusters/2' });
  });

  it('adds a site inside its cluster', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1');

    await user.click(await screen.findByRole('link', { name: '+ Add site' }));
    const form = await editor('New site');
    await user.type(form.getByLabelText('Name *'), 'Zo');
    await user.click(form.getByRole('button', { name: 'Add site' }));
    expect(await form.findByText('Use at least 3 characters.')).toBeVisible();
    expect(form.getByText('Click the map to place the site.')).toBeVisible();

    await user.type(form.getByLabelText('Name *'), 'nkwa');
    await user.click(screen.getByRole('button', { name: 'Map: click outside' }));
    expect(
      form.getByText("The site must be inside the Southern Kaduna cluster's area."),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Map: click inside' }));
    expect(form.getByLabelText('Centre point *')).toHaveValue('9.30000, 8.20000');
    await user.click(form.getByRole('button', { name: 'Add site' }));

    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 1, site: 10 }));
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/mini-grids',
        body: { name: 'Zonkwa', cluster_id: 1, geo_json: pointFeature(9.3, 8.2) },
      },
    ]);
  });

  it('moves a site by typing its position, and deletes a site without villages', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1&site=4');

    const form = await editor('Edit site · Zangon site');
    const centre = await form.findByLabelText('Centre point *');
    expect(centre).toHaveValue('9.60000, 8.60000');
    await user.clear(centre);
    await user.type(centre, 'north{Enter}');
    expect(form.getByText(/Write it as latitude, longitude/)).toBeVisible();
    await user.clear(centre);
    await user.type(centre, '9.4, 8.4{Enter}');
    await user.click(form.getByRole('button', { name: 'Save site' }));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      method: 'PUT',
      path: '/api/mini-grids/4',
      body: { name: 'Zangon site', cluster_id: 1, geo_json: pointFeature(9.4, 8.4) },
    });

    await user.click(form.getByRole('button', { name: 'Delete site' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete site' }),
    );
    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 1 }));
    expect(requests[1]).toMatchObject({ method: 'DELETE', path: '/api/mini-grids/4' });
  });

  it('keeps a site with villages and shows why a save failed', async () => {
    signIn();
    serveLocations();
    server.use(
      http.put('/api/mini-grids/:id', () =>
        HttpResponse.json(
          { message: 'The name is taken.', errors: { name: ['The name is taken.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/locations?cluster=1&site=3');

    const form = await editor("Edit site · Jema'a site");
    expect(await form.findByRole('button', { name: 'Delete site' })).toBeDisabled();
    await user.click(form.getByRole('button', { name: 'Save site' }));
    expect(await form.findByRole('alert')).toHaveTextContent(
      'The site was not saved: The name is taken.',
    );
    expect(form.getByText('The name is taken.')).toBeVisible();
  });

  it('adds a village in the usual country', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1&site=3&new=village');

    const form = await editor('New village');
    await vi.waitFor(() => expect(form.getByLabelText('Country *')).toHaveValue('7'));
    await user.type(form.getByLabelText('Name *'), 'Fadan');
    await user.click(screen.getByRole('button', { name: 'Map: click inside' }));
    await user.click(form.getByRole('button', { name: 'Add village' }));

    await vi.waitFor(() =>
      expect(router.state.location.search).toEqual({ cluster: 1, site: 3, village: 11 }),
    );
    expect(requests[0]).toEqual({
      method: 'POST',
      path: '/api/cities',
      body: { name: 'Fadan', mini_grid_id: 3, country_id: 7, geo_json: pointFeature(9.3, 8.2) },
    });
  });

  it('moves the people of a village elsewhere before deleting it', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1&site=3&village=6');

    const form = await editor('Edit village · Kafanchan North');
    await form.findByRole('option', { name: 'Ghana' });
    await user.selectOptions(form.getByLabelText('Country *'), 'Ghana');
    await user.click(form.getByRole('button', { name: 'Save village' }));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body).toMatchObject({ mini_grid_id: 3, country_id: 8 });

    await user.click(form.getByRole('button', { name: 'Delete village' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Amina Okafor')).toBeInTheDocument();
    expect(within(dialog).getByText('and 2 more')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Move and delete' }));
    expect(within(dialog).getByText('Pick the village they move to.')).toBeVisible();

    await user.click(within(dialog).getByRole('combobox', { name: 'Village to move them to' }));
    await user.click(await within(dialog).findByRole('option', { name: /^Kafanchan North/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Move and delete' }));
    expect(within(dialog).getByText('Pick a different village.')).toBeVisible();

    await user.clear(within(dialog).getByRole('combobox', { name: 'Village to move them to' }));
    await user.click(await within(dialog).findByRole('option', { name: /^Kafanchan$/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Move and delete' }));
    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 1, site: 3 }));
    expect(requests[1]).toEqual({
      method: 'DELETE',
      path: '/api/cities/6',
      body: { reassign_addresses_to: 5 },
    });
  });

  it('deletes an empty village straight away', async () => {
    signIn();
    const requests = serveLocations();
    const { user, router } = renderApp('/locations?cluster=1&site=3&village=5');

    const form = await editor('Edit village · Kafanchan');
    await user.click(form.getByRole('button', { name: 'Delete village' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText("This can't be undone.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete village' }));
    await vi.waitFor(() => expect(router.state.location.search).toEqual({ cluster: 1, site: 3 }));
    expect(requests[0]).toEqual({ method: 'DELETE', path: '/api/cities/5', body: undefined });
  });

  it('only shows locations to people without the settings permission', async () => {
    signIn({ permissions: ['customers'] });
    serveLocations();
    renderApp('/locations?cluster=1&site=3&village=6&new=village');

    const form = await editor('Edit village · Kafanchan North');
    expect(await form.findByLabelText('Name *')).toBeDisabled();
    expect(form.queryByRole('button', { name: 'Save village' })).not.toBeInTheDocument();
    expect(form.queryByRole('button', { name: 'Delete village' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ New cluster' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '+ Add village' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Map: click inside' })).not.toBeInTheDocument();
  });

  it('says when a location is gone and when the list cannot load', async () => {
    signIn();
    serveLocations();
    renderApp('/locations?cluster=1&site=3&village=99');
    expect(await screen.findByText('That village no longer exists.')).toBeInTheDocument();
    cleanup();

    server.use(
      http.get('/api/mini-grids', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    renderApp('/locations');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the locations: Down',
    );
  });

  it('opens on the map of everything', async () => {
    signIn();
    serveLocations();
    renderApp('/locations');

    expect(
      await screen.findByRole('img', { name: 'Map of all clusters, sites and villages' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pick a cluster, site or village/)).toBeInTheDocument();
  });
});
