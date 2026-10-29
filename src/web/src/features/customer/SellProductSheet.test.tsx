import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { SellProductSheet } from './SellProductSheet';

import type { Person } from '@/api/schemas';
import {
  addressFixture,
  productFixture,
  page,
  personFixture,
  stockDeviceFixture,
} from '@/test/fixtures';
import { renderWithQueryClient } from '@/test/render';
import { createGate } from '@/test/gate';
import { server } from '@/test/server';

const stock = [
  stockDeviceFixture({ id: 1, device_serial: 'SN-001' }),
  stockDeviceFixture({ id: 2, device_serial: 'SN-002' }),
];

/** Answers the sell sheet's requests; a sale is accepted once `saleGate` resolves. */
function stockHandlers(saleGate: Promise<unknown> = Promise.resolve()) {
  const stockQueries: Record<string, string>[] = [];
  const sales: unknown[] = [];
  server.use(
    http.get('/api/appliances', () =>
      HttpResponse.json({
        data: [productFixture(), productFixture({ id: 4, name: 'Television', price: 800 })],
      }),
    ),
    http.get('/api/devices', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      stockQueries.push(query);
      const serial = query.serial ?? '';
      return HttpResponse.json(
        page(stock.filter((device) => device.device_serial.startsWith(serial))),
      );
    }),
    http.post(
      '/api/appliances/person/:applianceId/people/:customerId',
      async ({ request, params }) => {
        await saleGate;
        sales.push({ params, body: await request.json() });
        return HttpResponse.json({ data: { id: 99 } });
      },
    ),
  );
  return { stockQueries, sales };
}

function renderSheet(customer: Person = personFixture()) {
  const onClose = vi.fn();
  const view = renderWithQueryClient(
    <SellProductSheet customer={customer} userId={1} currency="TZS" onClose={onClose} />,
  );
  return { onClose, ...view };
}

const productSelect = () => screen.getByRole('combobox', { name: /^Product/ });
const field = (name: string) => screen.getByRole('textbox', { name });
const selectedDevice = (serial: string) =>
  screen.queryByText((_, element) => element?.textContent === `Device ${serial} from stock`, {
    selector: 'span',
  });
const confirmButton = () => screen.getByRole('button', { name: 'Confirm sale' });

async function chooseSolarKit(user: ReturnType<typeof renderSheet>['user']) {
  await screen.findByRole('option', { name: 'Solar Kit · TZS 1,200' });
  await user.selectOptions(productSelect(), 'Solar Kit · TZS 1,200');
}

describe('SellProductSheet', () => {
  it('prefills the product price and previews a monthly plan', async () => {
    stockHandlers();
    const { user } = renderSheet();

    expect(screen.getByText('Fill in the plan to see the summary.')).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    await chooseSolarKit(user);

    expect(field('Total price')).toHaveValue('1200');
    expect(screen.getByText('Each installment').nextElementSibling).toHaveTextContent('TZS 100');
    expect(screen.getByText('First due')).toBeInTheDocument();
    expect(screen.getByText('Paid off')).toBeInTheDocument();
    expect(screen.getByText('No down payment')).toBeInTheDocument();
    expect(screen.getByText('Then TZS 100 per month')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it('updates the preview for a down payment and weekly installments', async () => {
    stockHandlers();
    const { user } = renderSheet();
    await chooseSolarKit(user);

    await user.clear(field('Down payment'));
    await user.type(field('Down payment'), '200');
    await user.clear(field('Number of installments'));
    await user.type(field('Number of installments'), '3');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Frequency/ }), 'Weekly');

    expect(screen.getByText('Down payment TZS 200 now')).toBeInTheDocument();
    expect(screen.getByText('Then TZS 333 per week')).toBeInTheDocument();
  });

  it('treats an empty down payment as none', async () => {
    stockHandlers();
    const { user } = renderSheet();
    await chooseSolarKit(user);

    await user.clear(field('Down payment'));

    expect(screen.getByText('No down payment')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
  });

  it.each([
    ['no installments', 'Number of installments', '0'],
    ['an empty installment count', 'Number of installments', ''],
    ['a down payment above the price', 'Down payment', '5000'],
    ['an empty price', 'Total price', ''],
  ])('blocks the sale with %s', async (_, label, value) => {
    stockHandlers();
    const { user } = renderSheet();
    await chooseSolarKit(user);

    await user.clear(field(label));
    if (value) {
      await user.type(field(label), value);
    }

    expect(screen.getByText('Fill in the plan to see the summary.')).toBeInTheDocument();
    expect(screen.queryByText('Each installment')).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it('sells an installment plan without a device', async () => {
    const saleGate = createGate();
    const { sales } = stockHandlers(saleGate.promise);
    const { user, onClose } = renderSheet();
    await chooseSolarKit(user);

    await user.click(confirmButton());

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    saleGate.open();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sales).toEqual([
      {
        params: { applianceId: '3', customerId: '7' },
        body: {
          user_id: 1,
          payment_type: 'installment',
          device_serial: null,
          points: null,
          cost: 1200,
          down_payment: 0,
          rate: 12,
          rate_type: 'monthly',
        },
      },
    ]);
  });

  it('refreshes the customer and contracts after a sale', async () => {
    stockHandlers();
    const { user, onClose, queryClient } = renderSheet();
    queryClient.setQueryData(['contracts', 7], []);
    queryClient.setQueryData(['customer', 7], personFixture());
    await chooseSolarKit(user);

    await user.click(confirmButton());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(queryClient.getQueryState(['contracts', 7])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['customer', 7])?.isInvalidated).toBe(true);
  });

  it('picks a device from stock installed at the home address', async () => {
    const { sales, stockQueries } = stockHandlers();
    const { user, onClose } = renderSheet();
    await chooseSolarKit(user);

    const devices = within(screen.getByRole('list', { name: 'Devices in stock' }));
    await user.click(await devices.findByRole('button', { name: 'SN-002' }));

    expect(stockQueries[0]).toEqual({ appliance_id: '3', unassigned: '1', per_page: '10' });
    expect(selectedDevice('SN-002')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Devices in stock' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: "Same as the customer's address" })).toBeChecked();

    await user.click(confirmButton());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sales).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ device_serial: 'SN-002', points: '-6.8,39.28' }),
      }),
    ]);
  });

  it('places the device on the map when it is installed elsewhere', async () => {
    const { sales } = stockHandlers();
    const { user, onClose } = renderSheet();
    await chooseSolarKit(user);
    await user.click(await screen.findByRole('button', { name: 'SN-001' }));

    await user.click(screen.getByRole('checkbox', { name: "Same as the customer's address" }));

    expect(
      screen.getByRole('img', { name: 'Drag the pin to where the device is installed' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Drag the pin to the installation site/)).toHaveTextContent(
      '-6.80000, 39.28000',
    );

    await user.click(confirmButton());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sales).toEqual([
      expect.objectContaining({ body: expect.objectContaining({ points: '-6.8,39.28' }) }),
    ]);
  });

  it('searches stock by serial and says when nothing matches', async () => {
    const { stockQueries } = stockHandlers();
    const { user } = renderSheet();
    await chooseSolarKit(user);

    await user.type(screen.getByRole('searchbox', { name: /Device from stock/ }), 'X');

    expect(
      await screen.findByText('No unassigned devices of this product match.'),
    ).toBeInTheDocument();
    expect(stockQueries.at(-1)).toMatchObject({ serial: 'X' });
  });

  it('lets the seller change the device and the product', async () => {
    stockHandlers();
    const { user } = renderSheet();
    await chooseSolarKit(user);
    await user.click(await screen.findByRole('button', { name: 'SN-001' }));

    await user.click(screen.getByRole('button', { name: 'Change' }));

    expect(await screen.findByRole('button', { name: 'SN-001' })).toBeInTheDocument();
    expect(selectedDevice('SN-001')).not.toBeInTheDocument();

    await user.selectOptions(productSelect(), 'Television · TZS 800');
    expect(field('Total price')).toHaveValue('800');

    await user.selectOptions(productSelect(), 'Choose a product');
    expect(field('Total price')).toHaveValue('');
    expect(screen.queryByRole('list', { name: 'Devices in stock' })).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it('saves a device without location when the customer address has none', async () => {
    const { sales } = stockHandlers();
    const { user, onClose } = renderSheet(
      personFixture({ addresses: [addressFixture({ geo: null })] }),
    );
    await chooseSolarKit(user);
    await user.click(await screen.findByRole('button', { name: 'SN-001' }));

    expect(screen.getByText(/has no map location/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(confirmButton());

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sales).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ device_serial: 'SN-001', points: null }),
      }),
    ]);
  });

  it('sells energy as a service', async () => {
    const { sales } = stockHandlers();
    const { user, onClose } = renderSheet(personFixture({ addresses: [] }));
    await chooseSolarKit(user);

    await user.click(screen.getByRole('radio', { name: /^Energy as a service/ }));

    expect(screen.getByRole('radio', { name: /^Energy as a service/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^Installments/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.queryByRole('textbox', { name: 'Total price' })).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();

    await user.type(field('Price per day'), '50');
    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    await user.type(field('Minimum payment'), '100');
    await user.click(confirmButton());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));

    expect(sales.map((sale) => (sale as { body: unknown }).body)).toEqual([
      {
        user_id: 1,
        payment_type: 'energy_service',
        device_serial: null,
        points: null,
        price_per_day: 50,
        minimum_payable_amount: 0,
      },
      expect.objectContaining({ price_per_day: 50, minimum_payable_amount: 100 }),
    ]);
  });

  it('shows why a sale was not saved and stays open', async () => {
    stockHandlers();
    server.use(
      http.post('/api/appliances/person/3/people/7', () =>
        HttpResponse.json({ message: 'Device already sold.' }, { status: 422 }),
      ),
    );
    const { user, onClose } = renderSheet();
    await chooseSolarKit(user);

    await user.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The sale was not saved: Device already sold.',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmButton()).toBeEnabled();
  });

  it('closes on cancel', async () => {
    stockHandlers();
    const { user, onClose } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
