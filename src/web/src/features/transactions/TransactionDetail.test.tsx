import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import type { TransactionDetail } from '@/api/transactions';
import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import { transactionDetailFixture, transactionListHandlers } from '@/test/transactionFixtures';

function openTransaction(transaction: TransactionDetail) {
  transactionListHandlers();
  server.use(
    http.get(`/api/transactions/${transaction.id}`, () => HttpResponse.json({ data: transaction })),
  );
  return renderApp(`/transactions?transaction=${transaction.id}`);
}

const panel = () => screen.getByRole('dialog');
const detail = (label: string) =>
  within(panel()).getByText(label, { selector: 'dt' }).nextElementSibling;

describe('TransactionDetail', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the amount, status and who paid for what', async () => {
    openTransaction(transactionDetailFixture({ id: 501 }));

    expect(
      await screen.findByRole('heading', { name: 'TZS 20,000 Confirmed' }),
    ).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Transaction #501 · Paystack · 28 Oct 2026');
    expect(detail('Provider')).toHaveTextContent('Paystack');
    expect(detail('Sender')).toHaveTextContent('+2348035550142');
    expect(within(detail('Customer') as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(detail('Customer')).toHaveTextContent('Chinedu Okafor · ID 7');
    expect(within(detail('Contract') as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/contracts/21',
    );
    expect(detail('Device')).toHaveTextContent('6380331184Solar home system');
    expect(detail('Type')).toHaveTextContent('Installment');
    expect(within(panel()).getByRole('link', { name: 'Open contract' })).toHaveAttribute(
      'href',
      '/contracts/21',
    );
  });

  it('shows the token, what the payment covered, the SMS and the raw provider record', async () => {
    openTransaction(transactionDetailFixture({ id: 501 }));

    expect(await screen.findByText('4821-7730-9154')).toBeInTheDocument();
    expect(panel()).toHaveTextContent('60 days of energy');

    const paid = within(panel()).getByRole('table');
    const rows = within(paid).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Installment due 05 Oct 2026TZS 10,000');
    expect(rows[2]).toHaveTextContent('Installment due 15 Oct 2026TZS 8,000 of TZS 10,000');
    expect(rows[3]).toHaveTextContent('EnergyTZS 2,000');
    expect(rows[4]).toHaveTextContent('TotalTZS 20,000');

    expect(panel()).toHaveTextContent('To +2348062217730');
    expect(panel()).toHaveTextContent('Delivered');
    expect(panel()).toHaveTextContent('Payment of 20,000 received.');

    const raw = within(panel()).getByText('Raw provider message').closest('details');
    expect(raw).toHaveTextContent('"reference": "PSK-7Q2M91XA"');
    expect(raw).not.toHaveTextContent('conflicts');
  });

  it('copies the token', async () => {
    const { user } = openTransaction(transactionDetailFixture({ id: 501 }));

    await user.click(await screen.findByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('4821-7730-9154');
  });

  it('warns about conflicts and names who recorded a cash payment', async () => {
    openTransaction(
      transactionDetailFixture({
        id: 502,
        original_transaction_type: 'cash_transaction',
        original_transaction: {
          id: 3,
          status: 0,
          conflicts: [
            { id: 1, state: 'Paid more than the open installments.' },
            { id: 2, state: 'Device not found.' },
          ],
          user: { name: 'Grace Admin' },
        },
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '2 conflictsPaid more than the open installments.Device not found.',
    );
    expect(detail('Recorded by')).toHaveTextContent('Grace Admin');
    expect(screen.getByRole('heading', { name: 'TZS 20,000 Processing' })).toBeInTheDocument();
  });

  it('shows a single conflict and a kWh token', async () => {
    openTransaction(
      transactionDetailFixture({
        id: 503,
        token: { token: '99887766', token_amount: 109.31, token_unit: 'kWh' },
        original_transaction: { id: 3, status: 1, conflicts: [{ id: 1, state: 'Late.' }] },
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('1 conflictLate.');
    expect(panel()).toHaveTextContent('109.31 kWh');
  });

  it('degrades to plain names without the customers permission', async () => {
    signIn({ permissions: ['transactions'] });
    openTransaction(transactionDetailFixture({ id: 501 }));

    expect(await screen.findByText('Chinedu Okafor', { exact: false })).toBeInTheDocument();
    expect(within(detail('Customer') as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(detail('Contract')).toHaveTextContent('Contract #21');
    expect(within(detail('Contract') as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(within(panel()).queryByRole('link', { name: 'Open contract' })).not.toBeInTheDocument();
  });

  it('shows a payment with no device, token, SMS, history or provider record', async () => {
    openTransaction(
      transactionDetailFixture({
        id: 504,
        device: null,
        message: 'SER-UNKNOWN',
        sender: null,
        type: 'energy',
        token: { token: 'T-1', token_amount: null, token_unit: null },
        sms: { receiver: null, body: 'Hi', status: 7, created_at: null },
        payment_histories: [],
        original_transaction: null,
      }),
    );

    expect(await screen.findByRole('heading', { name: 'TZS 20,000 Unknown' })).toBeInTheDocument();
    expect(detail('Customer')).toHaveTextContent('Unknown sender');
    expect(detail('Device')).toHaveTextContent('SER-UNKNOWN');
    expect(detail('Sender')).toHaveTextContent('—');
    expect(within(panel()).queryByRole('table')).not.toBeInTheDocument();
    expect(within(panel()).queryByText('Raw provider message')).not.toBeInTheDocument();
    expect(within(panel()).queryByText('Contract')).not.toBeInTheDocument();
  });

  it('finds the contract of an appliance sold without a device', async () => {
    openTransaction(
      transactionDetailFixture({
        id: 505,
        device: null,
        message: null,
        appliance: {
          id: 33,
          appliance: { name: 'Spark Steady Kit' },
          person: { id: 9, name: 'Halima', surname: 'Abubakar' },
        },
        payment_histories: [
          {
            id: 1,
            amount: 5000,
            payment_type: 'down_payment',
            paid_for_type: 'appliance_rate',
            paid_for: { appliance_person_id: 33, rate_cost: 5000, due_date: '2026-10-01' },
          },
          {
            id: 2,
            amount: 100,
            payment_type: 'access_rate',
            paid_for_type: 'access_rate',
            paid_for: null,
          },
        ],
      }),
    );

    expect(await screen.findByRole('link', { name: 'Spark Steady Kit' })).toHaveAttribute(
      'href',
      '/contracts/33',
    );
    expect(detail('Customer')).toHaveTextContent('Halima Abubakar · ID 9');
    expect(detail('Device')).toHaveTextContent('—');
    expect(panel()).toHaveTextContent('Down payment due 01 Oct 2026');
    expect(panel()).toHaveTextContent('Access rate');
  });

  it('lists every contract a payment covered', async () => {
    const [first, second] = transactionDetailFixture().payment_histories;
    if (!first || !second) {
      throw new Error('The fixture pays two installments.');
    }
    openTransaction(
      transactionDetailFixture({
        id: 506,
        payment_histories: [
          first,
          { ...second, paid_for: { appliance_person_id: 22, rate_cost: 8000, due_date: null } },
        ],
      }),
    );

    const contracts = await screen.findByText('Contracts', { selector: 'dt' });
    expect(contracts.nextElementSibling).toHaveTextContent('Contract #21Contract #22');
  });

  it('explains why the transaction did not load', async () => {
    transactionListHandlers();
    server.use(
      http.get('/api/transactions/507', () =>
        HttpResponse.json({ message: 'No query results' }, { status: 404 }),
      ),
    );
    const { user, router } = renderApp('/transactions?transaction=507');

    expect(
      await screen.findByText('Could not load this transaction: No query results'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transaction #507' })).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });
});
