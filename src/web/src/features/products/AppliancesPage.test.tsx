import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import type { Product } from '@/api/products';
import { productFixture, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const types = [
  { id: 1, name: 'Solar home system', paygo_enabled: true },
  { id: 3, name: 'Fan', paygo_enabled: false },
  { id: 4, name: 'Freezer', paygo_enabled: false },
];

const products: Product[] = [
  productFixture({ id: 1, name: 'Spark Steady Kit', price: 144000, sold_count: 186 }),
  productFixture({ id: 2, name: 'Spark Lamp Kit', price: 42000, sold_count: 0 }),
  productFixture({
    id: 3,
    name: 'Ceiling Fan',
    price: 15000,
    appliance_type_id: 3,
    appliance_type: { id: 3, name: 'Fan' },
  }),
];

/** Answers the page's reads and records every write. */
function applianceHandlers() {
  const writes: { method: string; path: string; body?: unknown }[] = [];
  const record = async (request: Request) => {
    writes.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: request.method === 'DELETE' ? undefined : await request.json(),
    });
  };
  server.use(
    http.get('/api/appliances/types', () => HttpResponse.json({ data: types })),
    http.get('/api/appliances', () => HttpResponse.json({ data: products })),
    http.post('/api/appliances', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: products });
    }),
    http.put('/api/appliances/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: products });
    }),
    http.delete('/api/appliances/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: {} });
    }),
    http.post('/api/appliances/types', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { id: 9, name: 'TV', paygo_enabled: false } });
    }),
    http.put('/api/appliances/types/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { ...types[1], name: 'Fans' } });
    }),
    http.delete('/api/appliances/types/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { message: 'deleted' } });
    }),
  );
  return writes;
}

const productTable = () => screen.getByRole('table', { name: 'Products' });
const typeList = () => within(screen.getByRole('list', { name: 'Product types' }));

describe('AppliancesPage', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the types with their product counts and every product with its sales', async () => {
    applianceHandlers();
    renderApp('/appliances');

    await screen.findByRole('list', { name: 'Product types' });
    const solar = typeList().getByRole('button', { name: /^Solar home system.*·/ });
    expect(solar).toHaveTextContent('2 products · PAYG');
    expect(typeList().getByRole('button', { name: /^Fan.*·/ })).toHaveTextContent(
      '1 product · Cash only',
    );
    const row = within(await screen.findByRole('table', { name: 'Products' })).getByRole('row', {
      name: /Spark Steady Kit/,
    });
    expect(row).toHaveTextContent('SHS');
    expect(row).toHaveTextContent('TZS 144,000');
    expect(row).toHaveTextContent('186');
    expect(
      within(row).getByRole('button', { name: "Spark Steady Kit was sold and can't be deleted" }),
    ).toBeDisabled();
    expect(
      typeList().getByRole('button', {
        name: "Solar home system has products and can't be deleted",
      }),
    ).toBeDisabled();
    expect(typeList().getByRole('button', { name: 'Delete Freezer' })).toBeEnabled();
    expect(
      within(screen.getByRole('list', { name: 'Products' })).getByText(/Ceiling Fan/),
    ).toBeInTheDocument();
  });

  it('filters by type and by name from the URL, and clears the type', async () => {
    applianceHandlers();
    const { user, router } = renderApp('/appliances?type=1&term=lamp');

    await screen.findByRole('table', { name: 'Products' });
    expect(within(productTable()).getAllByRole('row')).toHaveLength(2);
    expect(within(productTable()).getByText('Spark Lamp Kit')).toBeInTheDocument();
    expect(
      typeList().getByRole('button', { name: /^Solar home system.*·/, pressed: true }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all types' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ term: 'lamp' }));

    await user.click(typeList().getByRole('button', { name: /^Fan.*·/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ type: 3 }));
    expect(await screen.findByText('No products match.')).toBeInTheDocument();
  });

  it('searches products as the user types', async () => {
    applianceHandlers();
    const { user, router } = renderApp('/appliances');

    await user.type(await screen.findByRole('searchbox', { name: 'Search products' }), 'fan');

    await waitFor(() => expect(router.state.location.search).toEqual({ term: 'fan' }));
    expect(within(productTable()).getAllByRole('row')).toHaveLength(2);
  });

  it('adds a product to the selected type and checks the fields first', async () => {
    const writes = applianceHandlers();
    const { user } = renderApp('/appliances?type=3');

    await user.click(await screen.findByRole('button', { name: '+ New product' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New product' }));
    expect(sheet.getByRole('combobox', { name: 'Type *' })).toHaveValue('3');

    await user.click(sheet.getByRole('button', { name: 'Save product' }));
    expect(await sheet.findByText('Enter at least 3 characters.')).toBeInTheDocument();
    expect(sheet.getByText('Enter a whole amount.')).toBeInTheDocument();

    await user.type(sheet.getByRole('textbox', { name: 'Name *' }), 'Desk Fan');
    await user.type(sheet.getByRole('textbox', { name: 'Price (TZS) *' }), '0');
    await user.click(sheet.getByRole('button', { name: 'Save product' }));
    expect(await sheet.findByText('Enter at least 1.')).toBeInTheDocument();

    await user.clear(sheet.getByRole('textbox', { name: 'Price (TZS) *' }));
    await user.type(sheet.getByRole('textbox', { name: 'Price (TZS) *' }), '9000');
    await user.click(sheet.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/api/appliances',
        body: { name: 'Desk Fan', price: 9000, appliance_type_id: 3 },
      },
    ]);
  });

  it('edits a sold product, warns that old contracts keep their price, and moves its type', async () => {
    const writes = applianceHandlers();
    const { user } = renderApp('/appliances');

    await user.click(
      within(await screen.findByRole('table', { name: 'Products' })).getByRole('button', {
        name: 'Edit Spark Steady Kit',
      }),
    );
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit product' }));
    const price = sheet.getByRole('textbox', { name: 'Price (TZS) *' });
    expect(sheet.queryByText(/keep TZS 144,000/)).not.toBeInTheDocument();

    await user.clear(price);
    await user.type(price, '150000');
    expect(
      sheet.getByText(
        '186 contracts sold before keep TZS 144,000. The new price applies to new sales only.',
      ),
    ).toBeInTheDocument();
    await user.selectOptions(sheet.getByRole('combobox', { name: 'Type *' }), 'Freezer');
    await user.click(sheet.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      method: 'PUT',
      path: '/api/appliances/1',
      body: { name: 'Spark Steady Kit', price: 150000, appliance_type_id: 4 },
    });
  });

  it('shows the server validation errors next to the fields', async () => {
    applianceHandlers();
    server.use(
      http.put('/api/appliances/:id', () =>
        HttpResponse.json(
          { message: 'The name has already been taken.', errors: { name: ['Name taken.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/appliances');

    await user.click(
      within(await screen.findByRole('table', { name: 'Products' })).getByRole('button', {
        name: 'Edit Spark Lamp Kit',
      }),
    );
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit product' }));
    await user.click(sheet.getByRole('button', { name: 'Save product' }));

    expect(await sheet.findByText('Name taken.')).toBeInTheDocument();
    expect(sheet.getByRole('alert')).toHaveTextContent(
      'The product was not saved: The name has already been taken.',
    );
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes an unsold product, and shows the refusal when the server keeps it', async () => {
    const writes = applianceHandlers();
    const { user } = renderApp('/appliances');

    await user.click(
      within(await screen.findByRole('table', { name: 'Products' })).getByRole('button', {
        name: 'Delete Spark Lamp Kit',
      }),
    );
    let dialog = within(await screen.findByRole('dialog', { name: 'Delete Spark Lamp Kit?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete product' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ method: 'DELETE', path: '/api/appliances/2', body: undefined }]);

    server.use(
      http.delete('/api/appliances/:id', () =>
        HttpResponse.json(
          { message: 'Ceiling Fan has been sold or has devices linked.' },
          { status: 422 },
        ),
      ),
    );
    await user.click(within(productTable()).getByRole('button', { name: 'Delete Ceiling Fan' }));
    dialog = within(await screen.findByRole('dialog', { name: 'Delete Ceiling Fan?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete product' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'The product was not deleted: Ceiling Fan has been sold or has devices linked.',
    );
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('adds, renames and deletes types', async () => {
    const writes = applianceHandlers();
    const { user, router } = renderApp('/appliances?type=4');

    await user.click(await screen.findByRole('button', { name: '+ Add type' }));
    let sheet = within(await screen.findByRole('dialog', { name: 'New product type' }));
    await user.click(sheet.getByRole('button', { name: 'Save type' }));
    expect(await sheet.findByText('Enter at least 3 characters.')).toBeInTheDocument();
    await user.type(sheet.getByRole('textbox', { name: 'Name *' }), 'TV');
    await user.type(sheet.getByRole('textbox', { name: 'Name *' }), 's');
    await user.click(sheet.getByRole('button', { name: 'Save type' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Rename Fan' }));
    sheet = within(await screen.findByRole('dialog', { name: 'Rename type' }));
    await user.type(sheet.getByRole('textbox', { name: 'Name *' }), 's');
    await user.click(sheet.getByRole('button', { name: 'Save type' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete Freezer' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete Freezer?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete type' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(writes).toEqual([
      { method: 'POST', path: '/api/appliances/types', body: { name: 'TVs' } },
      { method: 'PUT', path: '/api/appliances/types/3', body: { name: 'Fans' } },
      { method: 'DELETE', path: '/api/appliances/types/4', body: undefined },
    ]);
    // The deleted type was the filter, so the filter goes too.
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('reports lists that cannot be loaded, and an empty catalogue', async () => {
    server.use(
      http.get('/api/appliances/types', () =>
        HttpResponse.json({ message: 'Boom' }, { status: 500 }),
      ),
      http.get('/api/appliances', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    renderApp('/appliances');

    expect(await screen.findByText('Could not load the product types: Boom')).toBeInTheDocument();
    expect(await screen.findByText('Could not load the products: Down')).toBeInTheDocument();
  });

  it('says when there is nothing yet', async () => {
    server.use(
      http.get('/api/appliances/types', () => HttpResponse.json({ data: [] })),
      http.get('/api/appliances', () => HttpResponse.json({ data: [] })),
    );
    renderApp('/appliances');

    expect(
      await screen.findByText('No product types yet. Add one to start selling.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
  });
});
