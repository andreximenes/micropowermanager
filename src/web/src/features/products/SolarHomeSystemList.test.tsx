import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { paginator, productFixture, signIn, solarHomeSystemFixture } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const owned = solarHomeSystemFixture();
const inStock = solarHomeSystemFixture({
  id: 59,
  serial_number: '6380331412',
  appliance: null,
  device: {
    ...owned.device,
    id: 292,
    person_id: null,
    person: null,
    manufacturer_mapping_status: 'not_mapped',
  },
});

/** Answers the list's requests and records the query of every page request. */
function listHandlers(rows: unknown[] = [owned, inStock], total = rows.length) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get('/api/solar-home-systems', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (query.per_page === '1') {
        return HttpResponse.json({ total: 612 });
      }
      queries.push(query);
      return HttpResponse.json(paginator(rows, { page: Number(query.page ?? 1), total }));
    }),
    http.get('/api/devices', () => HttpResponse.json({ total: 181 })),
  );
  return { lastQuery: () => queries.at(-1) };
}

const table = () => screen.getByRole('table', { name: 'Solar home systems' });

describe('SolarHomeSystemList', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the totals and each device with its product, owner and status', async () => {
    const { lastQuery } = listHandlers();
    renderApp('/solar-home-systems');

    expect(
      await screen.findByText('612 devices · 431 with a customer · 181 in stock'),
    ).toBeInTheDocument();
    const row = within(table()).getByRole('row', { name: /6380330900/ });
    expect(row).toHaveTextContent('Spark SHS');
    expect(row).toHaveTextContent('Solar Kit');
    expect(row).toHaveTextContent('With customer');
    expect(within(row).getByRole('link', { name: '6380330900' })).toHaveAttribute(
      'href',
      '/solar-home-systems/58',
    );
    expect(within(row).getByRole('link', { name: 'Amina Bello' })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    const stockRow = within(table()).getByRole('row', { name: /6380331412/ });
    expect(stockRow).toHaveTextContent('No product');
    expect(stockRow).toHaveTextContent('In stock');
    expect(stockRow).toHaveTextContent('Not mapped');
    const cards = within(screen.getByRole('list', { name: 'Solar home systems' }));
    expect(cards.getByRole('link', { name: /6380331412/ })).toHaveTextContent('No owner');
    expect(lastQuery()).toEqual({ per_page: '15', sort_by: '-updated_at' });
  });

  it('sends the search, sort and page in the URL and pages through', async () => {
    const { lastQuery } = listHandlers([owned], 40);
    const { user, router } = renderApp('/solar-home-systems?term=Amina&sort=owner&page=2');

    await screen.findByRole('table', { name: 'Solar home systems' });
    expect(lastQuery()).toEqual({ page: '2', per_page: '15', sort_by: 'owner', term: 'Amina' });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'serial_number');
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ term: 'Amina', sort: 'serial_number' }),
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), '-updated_at');
    await waitFor(() => expect(router.state.location.search).toEqual({ term: 'Amina' }));

    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
    await user.click(await screen.findByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ term: 'Amina' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ per_page: 50 }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '15');
    await waitFor(() => expect(router.state.location.search).toEqual({ term: 'Amina' }));

    await user.clear(screen.getByRole('searchbox', { name: 'Search solar home systems' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('offers to clear a search that finds nothing', async () => {
    listHandlers([]);
    const { user, router } = renderApp('/solar-home-systems?term=zzz');

    expect(await screen.findByText('No solar home systems match “zzz”.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('No solar home systems yet.')).toBeInTheDocument();
  });

  it('reports a list that cannot be loaded', async () => {
    server.use(
      http.get('/api/solar-home-systems', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    renderApp('/solar-home-systems');

    expect(
      await screen.findByText('Could not load solar home systems: Forbidden'),
    ).toBeInTheDocument();
  });
});

describe('AddDevicesSheet', () => {
  beforeEach(() => {
    signIn();
  });

  function addHandlers() {
    const bodies: unknown[] = [];
    listHandlers();
    server.use(
      http.get('/api/manufacturers', () =>
        HttpResponse.json({
          data: [
            { id: 1, name: 'Meters Inc', type: 'meter' },
            { id: 2, name: 'Spark SHS', type: 'shs' },
          ],
        }),
      ),
      http.get('/api/appliances', () =>
        HttpResponse.json({
          data: [
            productFixture(),
            productFixture({ id: 8, name: 'Fan', appliance_type_id: 3, appliance_type: null }),
          ],
        }),
      ),
      http.post('/api/solar-home-systems', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: [{ id: 1 }] });
      }),
    );
    return bodies;
  }

  async function openSheet() {
    const view = renderApp('/solar-home-systems');
    await view.user.click(await screen.findByRole('button', { name: '+ Add devices' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add devices' }));
    return { ...view, sheet };
  }

  it('collects pasted and typed serials, checks them and adds them', async () => {
    const bodies = addHandlers();
    const { user, sheet } = await openSheet();
    const serialBox = sheet.getByRole('textbox', { name: 'Serial number' });

    await user.click(sheet.getByRole('button', { name: 'Add devices' }));
    expect(await sheet.findByText('Add at least one serial.')).toBeInTheDocument();
    expect(sheet.getByText('Choose the manufacturer.')).toBeInTheDocument();
    expect(sheet.getByText('Choose the product.')).toBeInTheDocument();

    fireEvent.paste(serialBox, {
      clipboardData: { getData: () => '6380332001, 6380332002\n6380332001 short' },
    });
    const chips = () => within(sheet.getByRole('list', { name: 'Serials to add' }));
    expect(chips().getAllByRole('listitem')).toHaveLength(3);
    expect(chips().getByText('short').parentElement).toHaveTextContent('8–15 characters');
    expect(sheet.getByText('1 serial with the wrong length')).toBeInTheDocument();

    await user.click(chips().getByRole('button', { name: 'Remove short' }));
    await user.type(serialBox, '6380332003{Enter}6380332004');
    expect(sheet.getByRole('button', { name: 'Add 4 devices' })).toBeInTheDocument();
    await user.type(serialBox, '{Backspace>10}{Backspace}');
    expect(chips().getAllByRole('listitem')).toHaveLength(2);

    const manufacturer = sheet.getByRole('combobox', { name: 'Manufacturer *' });
    expect(within(manufacturer).queryByText('Meters Inc')).not.toBeInTheDocument();
    await user.selectOptions(manufacturer, 'Spark SHS');
    const product = sheet.getByRole('combobox', { name: 'Product *' });
    expect(within(product).queryByText('Fan')).not.toBeInTheDocument();
    await user.selectOptions(product, 'Solar Kit');
    await user.type(serialBox, '6380332009');
    await user.click(sheet.getByRole('button', { name: 'Add 3 devices' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([
      {
        serial_numbers: ['6380332001', '6380332002', '6380332009'],
        manufacturer_id: 2,
        appliance_id: 3,
      },
    ]);
  });

  it('marks the serials the server refuses and holds the rest until they are removed', async () => {
    addHandlers();
    server.use(
      http.post('/api/solar-home-systems', () =>
        HttpResponse.json(
          {
            message: 'The serial_numbers.1 has already been taken.',
            errors: {
              'serial_numbers.1': ['Already in the system'],
              manufacturer_id: ['Not a solar home system manufacturer.'],
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user, sheet } = await openSheet();

    await user.type(
      sheet.getByRole('textbox', { name: 'Serial number' }),
      '6380332001 6380330900 ',
    );
    await user.selectOptions(sheet.getByRole('combobox', { name: 'Manufacturer *' }), 'Spark SHS');
    await user.selectOptions(sheet.getByRole('combobox', { name: 'Product *' }), 'Solar Kit');
    await user.click(sheet.getByRole('button', { name: 'Add 2 devices' }));

    expect(await sheet.findByText(/Already in the system/)).toBeInTheDocument();
    expect(sheet.getByText('Not a solar home system manufacturer.')).toBeInTheDocument();
    expect(sheet.getByRole('alert')).toHaveTextContent('No devices were added');
    expect(sheet.getByText('1 serial refused. Remove it to add the rest.')).toBeInTheDocument();

    await user.click(sheet.getByRole('button', { name: 'Remove 6380330900' }));
    expect(sheet.getByText('1 new device')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
