import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { RecordPaymentSheet } from './RecordPaymentSheet';
import { scheduleOf } from './schedule';

import { contractDetailSchema } from '@/api/contracts';
import { contractDetailFixture, energyContractFixture } from '@/test/contractFixtures';
import { createGate } from '@/test/gate';
import { renderWithQueryClient } from '@/test/render';
import { server } from '@/test/server';

type PaymentServer = {
  providers?: { id: number; name: string }[];
  statuses?: string[];
  started?: Record<string, unknown>;
  gate?: Promise<unknown>;
};

function paymentHandlers({
  providers = [],
  statuses = ['processed'],
  started = {},
  gate = Promise.resolve(),
}: PaymentServer = {}) {
  const payments: unknown[] = [];
  let checks = 0;
  server.use(
    http.get('/api/appliances/payment/providers', () => HttpResponse.json({ data: providers })),
    http.post('/api/appliances/payment/21', async ({ request }) => {
      await gate;
      payments.push(await request.json());
      return HttpResponse.json({ data: { transaction_id: 9, ...started } });
    }),
    http.get('/api/appliances/payment/status/9', () => {
      const status = statuses[Math.min(checks, statuses.length - 1)];
      checks += 1;
      return HttpResponse.json({ data: { status, processed: status === 'processed' } });
    }),
  );
  return { payments };
}

function renderSheet(raw: unknown = contractDetailFixture()) {
  const contract = contractDetailSchema.parse(raw);
  const onClose = vi.fn();
  const onRecorded = vi.fn(() => Promise.resolve());
  const view = renderWithQueryClient(
    <RecordPaymentSheet
      contract={contract}
      schedule={scheduleOf(contract)}
      currency="TZS"
      onClose={onClose}
      onRecorded={onRecorded}
      pollIntervalMs={1}
    />,
  );
  return { onClose, onRecorded, ...view };
}

const amountField = () => screen.getByRole('textbox', { name: 'Amount' });
const covered = () => within(screen.getByRole('list', { name: 'Installments covered' }));

async function enterAmount(user: ReturnType<typeof renderSheet>['user'], amount: string) {
  await user.clear(amountField());
  await user.type(amountField(), amount);
}

describe('RecordPaymentSheet', () => {
  it('starts from the next installment and shows what it pays off', () => {
    paymentHandlers();
    renderSheet();

    expect(screen.getByText('Solar Kit · TZS 750 to pay')).toBeInTheDocument();
    expect(amountField()).toHaveValue('250');
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked();
    expect(covered().getAllByRole('listitem')).toHaveLength(1);
    expect(covered().getByText('TZS 250 · paid')).toBeInTheDocument();
    expect(screen.getByText(/A token for the device is generated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record TZS 250 in cash' })).toBeEnabled();
  });

  it('previews a payment flowing over into the following installment', async () => {
    paymentHandlers();
    const { user } = renderSheet();

    await enterAmount(user, '300');

    const rows = covered().getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Installment 2 · 01 Apr 2020TZS 250 · paid');
    expect(rows[1]).toHaveTextContent('Installment 3 · 01 Jan 2099TZS 50 of TZS 250');
  });

  it('fills the amount from the quick picks', async () => {
    paymentHandlers();
    const { user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Pay off · TZS 750' }));
    expect(amountField()).toHaveValue('750');
    expect(covered().getAllByRole('listitem')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Next installment · TZS 250' }));
    expect(amountField()).toHaveValue('250');
  });

  it.each([
    ['too little', '100', 'Pay at least TZS 250, what is left of the next installment.'],
    ['too much', '800', 'Only TZS 750 is left to pay.'],
    ['nothing', '0', 'Enter an amount above zero.'],
  ])('blocks %s', async (_, amount, message) => {
    paymentHandlers();
    const { user } = renderSheet();

    await enterAmount(user, amount);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
    expect(screen.queryByText('This payment covers')).not.toBeInTheDocument();
  });

  it('records a cash payment and reports it once processed', async () => {
    const gate = createGate();
    const { payments } = paymentHandlers({
      statuses: ['processing', 'processed'],
      gate: gate.promise,
    });
    const { user, onRecorded, onClose } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Record TZS 250 in cash' }));

    expect(await screen.findByRole('button', { name: 'Recording…' })).toBeDisabled();
    expect(amountField()).toBeDisabled();
    gate.open();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The payment of TZS 250 in cash recorded.',
    );
    expect(payments).toEqual([{ amount: 250, payment_provider: 0 }]);
    expect(onRecorded).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('This payment covers')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('pays through a provider and opens its checkout page', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { payments } = paymentHandlers({
      providers: [{ id: 3, name: 'Paystack' }],
      started: { redirect_url: 'https://checkout.example.com/pay/9' },
    });
    const { user } = renderSheet();

    await user.click(await screen.findByRole('radio', { name: 'Paystack' }));
    await user.click(screen.getByRole('button', { name: 'Record TZS 250 via Paystack' }));

    expect(await screen.findByRole('status')).toHaveTextContent('recorded');
    expect(payments).toEqual([{ amount: 250, payment_provider: 3 }]);
    expect(open).toHaveBeenCalledWith('https://checkout.example.com/pay/9', '_blank', 'noopener');
  });

  it('says so when the payment fails', async () => {
    paymentHandlers({ statuses: ['failed'] });
    const { user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Record TZS 250 in cash' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The payment of TZS 250 in cash failed. Nothing was added to this contract.',
    );
  });

  it('says the payment is still processing when it does not settle in time', async () => {
    paymentHandlers({ statuses: ['processing'] });
    const { user } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Record TZS 250 in cash' }));

    expect(await screen.findByRole('status', {}, { timeout: 3000 })).toHaveTextContent(
      'is still being processed',
    );
  });

  it('shows the reason the backend refused the payment', async () => {
    server.use(
      http.get('/api/appliances/payment/providers', () => HttpResponse.json({ data: [] })),
      http.post('/api/appliances/payment/21', () =>
        HttpResponse.json(
          { message: 'Payment amount can not smaller than installment cost' },
          { status: 422 },
        ),
      ),
    );
    const { user, onRecorded } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Record TZS 250 in cash' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The payment was not recorded: Payment amount can not smaller than installment cost',
    );
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('falls back to cash when the providers cannot be loaded', async () => {
    server.use(
      http.get('/api/appliances/payment/providers', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    renderSheet();

    expect(
      await screen.findByText('Only cash is available: the payment providers could not be loaded.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  describe('energy as a service', () => {
    it('can be paid without any rates, from the minimum, in days of energy', async () => {
      const { payments } = paymentHandlers();
      const { user } = renderSheet(energyContractFixture({ device: null }));

      expect(screen.getByText('Solar Kit · TZS 50 per day')).toBeInTheDocument();
      expect(amountField()).toHaveValue('500');
      expect(screen.getByText('This payment covers 10 days of energy.')).toBeInTheDocument();
      expect(screen.queryByText(/A token for the device/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Pay off/ })).not.toBeInTheDocument();

      await enterAmount(user, '1275');
      expect(screen.getByText('This payment covers 25 days of energy.')).toBeInTheDocument();

      await enterAmount(user, '400');
      expect(screen.getByRole('alert')).toHaveTextContent('The minimum payment is TZS 500.');

      await user.click(screen.getByRole('button', { name: 'Minimum · TZS 500' }));
      await user.click(screen.getByRole('button', { name: 'Record TZS 500 in cash' }));

      await screen.findByRole('status');
      expect(payments).toEqual([{ amount: 500, payment_provider: 0 }]);
    });

    it('starts empty without a minimum', () => {
      paymentHandlers();
      renderSheet(energyContractFixture({ minimum_payable_amount: null, appliance: null }));

      expect(screen.getByText('Product · TZS 50 per day')).toBeInTheDocument();
      expect(amountField()).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: /Minimum/ })).not.toBeInTheDocument();
    });
  });
});
