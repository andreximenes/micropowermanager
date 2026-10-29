import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import {
  ALL_PERMISSIONS,
  contractFixture,
  paginator,
  productFixture,
  signIn,
  solarHomeSystemFixture,
} from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const capabilities = (overrides: Record<string, unknown> = {}) => ({
  token_generation: true,
  unlock_token: true,
  reset_token: true,
  credit_unit: 'days',
  token_generation_blocked_reason: null,
  ...overrides,
});

const payment = {
  id: 1,
  amount: 10000,
  payment_service: 'paystack_transaction',
  payment_type: 'installment',
  created_at: '2026-10-28T09:14:00Z',
  paid_for: { token: '1', token_amount: 30, token_unit: 'days' },
};

type DetailData = {
  solarHomeSystem?: Record<string, unknown>;
  caps?: Record<string, unknown>;
  payments?: unknown[];
  totalPayments?: number;
};

/** Answers every read of the detail page and records the writes. */
function detailHandlers({
  solarHomeSystem = solarHomeSystemFixture(),
  caps = capabilities(),
  payments = [payment],
  totalPayments = payments.length,
}: DetailData = {}) {
  const writes: { method: string; path: string; body?: unknown }[] = [];
  const paymentQueries: Record<string, string>[] = [];
  server.use(
    http.get('/api/solar-home-systems/58', () => HttpResponse.json({ data: solarHomeSystem })),
    http.get('/api/solar-home-systems/58/transactions', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      paymentQueries.push(query);
      return HttpResponse.json(
        paginator(payments, {
          page: Number(query.page),
          perPage: Number(query.per_page),
          total: totalPayments,
        }),
      );
    }),
    http.get('/api/devices/291/capabilities', () => HttpResponse.json({ data: caps })),
    http.get('/api/appliances/person/people/7', () =>
      HttpResponse.json({ data: [contractFixture({ device_serial: '6380330900' })] }),
    ),
    http.post('/api/devices/291/token', async ({ request }) => {
      const body = (await request.json()) as { type: string };
      writes.push({ method: 'POST', path: '/token', body });
      return HttpResponse.json({
        data: {
          id: 99,
          token: body.type === 'credit' ? '1111222233334444' : '5555666677778888',
          token_amount: body.type === 'credit' ? 30 : null,
          token_unit: body.type === 'credit' ? 'days' : null,
          created_at: '2026-10-29T10:00:00Z',
        },
      });
    }),
    http.get('/api/manufacturers', () =>
      HttpResponse.json({ data: [{ id: 2, name: 'Spark SHS', type: 'shs' }] }),
    ),
    http.get('/api/appliances', () =>
      HttpResponse.json({ data: [productFixture(), productFixture({ id: 5, name: 'Big Kit' })] }),
    ),
    http.put('/api/solar-home-systems/58', async ({ request }) => {
      writes.push({ method: 'PUT', path: '/58', body: await request.json() });
      return HttpResponse.json({ data: { id: 58 } });
    }),
    http.delete('/api/solar-home-systems/58', () => {
      writes.push({ method: 'DELETE', path: '/58' });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { writes, paymentQueries };
}

const heading = () => screen.findByRole('heading', { level: 1, name: '6380330900' });
const control = () =>
  within(
    screen.getByRole('heading', { name: 'Device control' }).closest('.rounded-lg') as HTMLElement,
  );

describe('SolarHomeSystemDetail', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the device, its owner and contract, its location and its payments', async () => {
    detailHandlers();
    renderApp('/solar-home-systems/58');

    await heading();
    expect(screen.getByText('With customer')).toBeInTheDocument();
    expect(screen.getAllByText('Mapped').length).toBeGreaterThan(0);
    expect(screen.getByText('Manufacturer Spark SHS')).toBeInTheDocument();
    expect(screen.getByText('Added 02 Jun 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(screen.getByText('+2348035550142 · Kafanchan')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Solar Kit · 3 installments' })).toHaveAttribute(
      'href',
      '/contracts/21',
    );
    expect(screen.getByText('TZS 400 of TZS 1,200')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Map with the location/ })).toBeInTheDocument();
    expect(screen.getByText('12 Market Road · 9.57621, 8.29850')).toBeInTheDocument();
    expect(screen.getByText('4821 7730 9154 0062')).toBeInTheDocument();

    const row = within(await screen.findByRole('table', { name: 'Transactions' })).getByRole(
      'row',
      { name: /28 Oct 2026/ },
    );
    expect(row).toHaveTextContent('Paystack');
    expect(row).toHaveTextContent('Installment');
    expect(row).toHaveTextContent('TZS 10,000');
    expect(row).toHaveTextContent('30 days');
  });

  it('shows a device in stock with no location, energy plan and no payments', async () => {
    const raw = solarHomeSystemFixture();
    detailHandlers({
      solarHomeSystem: solarHomeSystemFixture({
        appliance: null,
        tokens: [],
        device: { ...raw.device, person_id: null, person: null, geo: null },
      }),
      payments: [],
    });
    renderApp('/solar-home-systems/58');

    await heading();
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('No product')).toBeInTheDocument();
    expect(screen.getByText(/no customer owns this device yet/)).toBeInTheDocument();
    expect(screen.getByText('No location recorded for this device.')).toBeInTheDocument();
    expect(screen.getByText('No token issued yet.')).toBeInTheDocument();
    expect(await screen.findByText('No payments yet.')).toBeInTheDocument();
  });

  it('pages through the payments', async () => {
    const { paymentQueries } = detailHandlers({ totalPayments: 30 });
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(paymentQueries.at(-1)).toEqual({ page: '2', per_page: '10' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '25');
    await waitFor(() => expect(paymentQueries.at(-1)).toEqual({ page: '1', per_page: '25' }));
  });

  it('generates a credit token in the unit chosen', async () => {
    const { writes } = detailHandlers();
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    const credit = await control().findByRole('textbox', { name: 'Credit' });
    const generate = control().getByRole('button', { name: 'Generate token' });
    expect(generate).toBeDisabled();
    await user.type(credit, '30');
    await user.click(generate);

    expect(await control().findByText('1111 2222 3333 4444')).toBeInTheDocument();
    expect(control().getByText(/New token · 29 Oct 2026, .* · 30 days/)).toBeInTheDocument();

    await user.selectOptions(control().getByRole('combobox', { name: 'Credit unit' }), 'TZS');
    await user.type(credit, '5000');
    await user.click(generate);
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes.map((write) => write.body)).toEqual([
      { type: 'credit', amount: 30, unit: 'days' },
      { type: 'credit', amount: 5000, unit: 'currency' },
    ]);
  });

  it('explains why no credit token can be issued, and reports a refused token', async () => {
    detailHandlers({
      caps: capabilities({
        unlock_token: false,
        reset_token: false,
        credit_unit: null,
        token_generation_blocked_reason: 'This device has no price per day.',
      }),
    });
    server.use(
      http.post('/api/devices/291/token', () =>
        HttpResponse.json({ message: 'Spark is down' }, { status: 502 }),
      ),
    );
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    expect(
      await control().findByText('No credit token: This device has no price per day.'),
    ).toBeInTheDocument();
    expect(control().queryByRole('button', { name: 'Unlock permanently' })).not.toBeInTheDocument();
    await user.type(control().getByRole('textbox', { name: 'Credit' }), '10');
    await user.click(control().getByRole('button', { name: 'Generate token' }));
    expect(await control().findByText('No token was generated: Spark is down')).toBeInTheDocument();
  });

  it('unlocks and resets after asking', async () => {
    const { writes } = detailHandlers();
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(await control().findByRole('button', { name: 'Unlock permanently' }));
    let dialog = within(
      await screen.findByRole('dialog', { name: 'Unlock 6380330900 permanently?' }),
    );
    await user.click(dialog.getByRole('button', { name: 'Unlock permanently' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(control().getByText('5555 6666 7777 8888')).toBeInTheDocument();

    await user.click(control().getByRole('button', { name: 'Reset credit' }));
    dialog = within(await screen.findByRole('dialog', { name: 'Reset the credit on 6380330900?' }));
    await user.click(dialog.getByRole('button', { name: 'Reset credit' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes.map((write) => write.body)).toEqual([{ type: 'unlock' }, { type: 'reset' }]);
  });

  it.each([
    [
      { supported: true, mapped: true, device: { model: 'Steady', nested: {} } },
      /knows this device/,
    ],
    [{ supported: true, mapped: false, device: null }, /does not have this device/],
    [{ supported: false }, /has no device API/],
  ])('checks the mapping with the manufacturer', async (answer, message) => {
    detailHandlers();
    server.use(http.get('/api/devices/291/device-info', () => HttpResponse.json({ data: answer })));
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(control().getByRole('button', { name: 'Check with manufacturer' }));
    expect(await control().findByText(message)).toBeInTheDocument();
  });

  it('shows the model the manufacturer reports, and a failed check', async () => {
    detailHandlers();
    server.use(
      http.get('/api/devices/291/device-info', () =>
        HttpResponse.json({ data: { supported: true, mapped: true, device: { model: 'Steady' } } }),
      ),
    );
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(control().getByRole('button', { name: 'Check with manufacturer' }));
    expect(await control().findByText('Steady')).toBeInTheDocument();

    server.use(
      http.get('/api/devices/291/device-info', () =>
        HttpResponse.json({ message: 'Timeout' }, { status: 503 }),
      ),
    );
    await user.click(control().getByRole('button', { name: 'Check with manufacturer' }));
    expect(await control().findByText('The check failed: Timeout')).toBeInTheDocument();
  });

  it('hides device control without the transactions permission', async () => {
    signIn({ permissions: ALL_PERMISSIONS.filter((permission) => permission !== 'transactions') });
    detailHandlers();
    renderApp('/solar-home-systems/58');

    await heading();
    expect(screen.queryByRole('heading', { name: 'Device control' })).not.toBeInTheDocument();
  });

  it('reports capabilities that cannot be read', async () => {
    detailHandlers();
    server.use(
      http.get('/api/devices/291/capabilities', () =>
        HttpResponse.json({ message: 'Nope' }, { status: 500 }),
      ),
    );
    renderApp('/solar-home-systems/58');

    await heading();
    expect(
      await control().findByText('Could not read what the device supports: Nope'),
    ).toBeInTheDocument();
  });

  it('edits the product and sends the serial only when it changed', async () => {
    const { writes } = detailHandlers();
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit solar home system' }));
    const product = sheet.getByRole('combobox', { name: 'Product *' });
    await waitFor(() => expect(product).toHaveValue('3'));
    await user.selectOptions(product, 'Big Kit');
    await user.click(sheet.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const again = within(await screen.findByRole('dialog', { name: 'Edit solar home system' }));
    const serial = again.getByRole('textbox', { name: 'Serial number *' });
    await user.clear(serial);
    await user.click(again.getByRole('button', { name: 'Save changes' }));
    expect(await again.findByText('Enter the serial number.')).toBeInTheDocument();
    await user.type(serial, '6380339999');
    await user.click(again.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(writes).toHaveLength(2));

    expect(writes.map((write) => write.body)).toEqual([
      { manufacturer_id: 2, appliance_id: 5 },
      { serial_number: '6380339999', manufacturer_id: 2, appliance_id: 3 },
    ]);
  });

  it('reports manufacturers that cannot be loaded in the edit sheet', async () => {
    detailHandlers();
    server.use(
      http.get('/api/manufacturers', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit solar home system' }));
    expect(
      await sheet.findByText('Could not load the manufacturers or products: Down'),
    ).toBeInTheDocument();
  });

  it('shows the newest token and names an unknown manufacturer plainly', async () => {
    detailHandlers({
      solarHomeSystem: solarHomeSystemFixture({
        manufacturer: null,
        tokens: [
          { id: 2, token: '22223333', created_at: '2026-10-20T00:00:00Z' },
          { id: 1, token: '11112222', created_at: null },
        ],
      }),
      caps: capabilities({ credit_unit: null }),
    });
    renderApp('/solar-home-systems/58');

    await heading();
    expect(screen.getByText('Manufacturer —')).toBeInTheDocument();
    expect(control().getByText('Tokens come from the manufacturer')).toBeInTheDocument();
    expect(control().getByText('2222 3333')).toBeInTheDocument();
    expect(
      within(await control().findByRole('combobox', { name: 'Credit unit' })).getAllByRole(
        'option',
      ),
    ).toHaveLength(1);
  });

  it('shows why a serial cannot change', async () => {
    detailHandlers();
    server.use(
      http.put('/api/solar-home-systems/58', () =>
        HttpResponse.json(
          { message: 'Solar Home System 6380330900 already has payments.' },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit solar home system' }));
    await user.click(sheet.getByRole('button', { name: 'Save changes' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent(
      'The changes were not saved: Solar Home System 6380330900 already has payments.',
    );
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
  });

  it('deletes the device and returns to the list', async () => {
    const { writes } = detailHandlers();
    server.use(http.get('/api/solar-home-systems', () => HttpResponse.json(paginator([]))));
    server.use(http.get('/api/devices', () => HttpResponse.json({ total: 0 })));
    const { user, router } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete 6380330900?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete device' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/solar-home-systems'));
    expect(writes).toEqual([{ method: 'DELETE', path: '/58' }]);
  });

  it('keeps a device with activity and says why', async () => {
    detailHandlers();
    server.use(
      http.delete('/api/solar-home-systems/58', () =>
        HttpResponse.json({ message: 'It already has payments.' }, { status: 422 }),
      ),
    );
    const { user } = renderApp('/solar-home-systems/58');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete 6380330900?' }));
    await user.click(dialog.getByRole('button', { name: 'Delete device' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'The device was not deleted: It already has payments.',
    );
  });

  it('reports a device or payments that cannot be loaded', async () => {
    server.use(
      http.get('/api/solar-home-systems/58', () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );
    renderApp('/solar-home-systems/58');

    expect(
      await screen.findByText('Could not load this solar home system: Not found'),
    ).toBeInTheDocument();
  });

  it('reports payments that cannot be loaded', async () => {
    detailHandlers();
    server.use(
      http.get('/api/solar-home-systems/58/transactions', () =>
        HttpResponse.json({ message: 'Down' }, { status: 500 }),
      ),
    );
    renderApp('/solar-home-systems/58');

    expect(await screen.findByText('Could not load the transactions: Down')).toBeInTheDocument();
  });
});
