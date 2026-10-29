import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { ALL_PERMISSIONS, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import {
  listedTransactionFixture,
  periodTotals,
  transactionDetailFixture,
  transactionListHandlers,
} from '@/test/transactionFixtures';

const table = () => screen.getByRole('table', { name: 'Transactions' });
const cards = () => screen.getByRole('list', { name: 'Transactions' });
const totals = () => screen.getByRole('region', { name: 'Totals' });

describe('TransactionList', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows one row per payment with status, provider, sender, customer, amount, type and date', async () => {
    transactionListHandlers();
    renderApp('/transactions');

    const row = await within(await screen.findByRole('table', { name: 'Transactions' })).findByRole(
      'row',
      { name: /Amina Bello/ },
    );
    expect(row).toHaveTextContent('Confirmed');
    expect(row).toHaveTextContent('Paystack');
    expect(row).toHaveTextContent('+2348035550142');
    expect(row).toHaveTextContent('TZS 10,000');
    expect(row).toHaveTextContent('Installment');
    expect(row).toHaveTextContent('28 Oct 2026');
    expect(within(row).getByRole('link', { name: 'Amina Bello' })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(screen.getByText('1–1 of 1 transaction')).toBeInTheDocument();
  });

  it('names unknown senders and shows each status in its own words', async () => {
    transactionListHandlers({
      rows: [
        listedTransactionFixture({
          id: 1,
          device: null,
          type: null,
          original_transaction: { id: 1, status: 0 },
        }),
        listedTransactionFixture({ id: 2, original_transaction: { id: 2, status: -1 } }),
        listedTransactionFixture({ id: 3, original_transaction: { id: 3, status: 3 } }),
        listedTransactionFixture({ id: 4, original_transaction: null, type: 'down_payment' }),
      ],
    });
    renderApp('/transactions');

    const rows = within(await screen.findByRole('table', { name: 'Transactions' })).getAllByRole(
      'row',
    );
    expect(rows[1]).toHaveTextContent('Processing');
    expect(rows[1]).toHaveTextContent('Unknown sender');
    expect(rows[2]).toHaveTextContent('Rejected');
    expect(rows[3]).toHaveTextContent('Cancelled');
    expect(rows[4]).toHaveTextContent('Unknown');
    expect(rows[4]).toHaveTextContent('Down payment');
  });

  it('shows customer names without links when the user cannot open customers', async () => {
    signIn({ permissions: ['transactions'] });
    transactionListHandlers();
    renderApp('/transactions');

    const row = await within(await screen.findByRole('table', { name: 'Transactions' })).findByRole(
      'row',
      { name: /Amina Bello/ },
    );
    expect(within(row).queryByRole('link', { name: 'Amina Bello' })).not.toBeInTheDocument();
  });

  it('shows each payment as a card for phones too, opening the transaction', async () => {
    transactionListHandlers({
      rows: [
        listedTransactionFixture({ device: null, original_transaction_type: 'cash_transaction' }),
      ],
    });
    renderApp('/transactions?per_page=50');

    const card = await within(await screen.findByRole('list', { name: 'Transactions' })).findByRole(
      'link',
    );
    expect(card).toHaveTextContent('Unknown sender');
    expect(card).toHaveTextContent('TZS 10,000');
    expect(card).toHaveTextContent('Installment · Cash · 28 Oct 2026');
    expect(card).toHaveAttribute('href', '/transactions?per_page=50&transaction=501');
    expect(cards()).toBeInTheDocument();
  });

  describe('totals', () => {
    it('compares the last 30 days with the 30 before by default', async () => {
      const { periods } = transactionListHandlers();
      renderApp('/transactions');

      expect(
        await screen.findByText('Last 30 days · compared with the 30 days before'),
      ).toBeInTheDocument();
      await waitFor(() => expect(within(totals()).getByText('412')).toBeInTheDocument());
      expect(periods).toEqual(['3']);
      expect(totals()).toHaveTextContent('Received412+8.4% vs the 30 days before');
      expect(totals()).toHaveTextContent('Confirmed396+9.1% vs the 30 days before');
      expect(totals()).toHaveTextContent('Cancelled or rejected11+3 vs the 30 days before');
      expect(totals()).toHaveTextContent('RevenueTZS 4,926,000−2.6% vs the 30 days before');
    });

    it('switches period from the URL and says when there is nothing to compare with', async () => {
      const { periods } = transactionListHandlers({
        current: periodTotals({ total: 2, confirmed: 2, amount: 500 }),
        past: periodTotals(),
      });
      const { user, router } = renderApp('/transactions');

      await user.click(await screen.findByRole('radio', { name: 'Yesterday' }));

      expect(router.state.location.search).toEqual({ period: 0 });
      expect(
        await screen.findByText('Yesterday · compared with the day before'),
      ).toBeInTheDocument();
      await waitFor(() => expect(periods).toContain('0'));
      await waitFor(() => expect(totals()).toHaveTextContent('Received2None the day before'));
      expect(totals()).toHaveTextContent('Cancelled or rejected0No change vs the day before');

      await user.click(screen.getByRole('radio', { name: '30 days' }));
      expect(router.state.location.search).toEqual({});
    });

    it('explains why the totals did not load', async () => {
      transactionListHandlers();
      server.use(
        http.get('/api/transactions/analytics/:period', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );
      renderApp('/transactions');

      expect(
        await screen.findByText('Could not load the totals: Server error'),
      ).toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('sends every filter from the URL and lists them as removable chips', async () => {
      const { lastQuery } = transactionListHandlers();
      const { user, router } = renderApp(
        '/transactions?serial=6380&status=processing&provider=paystack_transaction&device=solar_home_system&from=2026-10-01&to=2026-10-31&page=2',
      );

      await waitFor(() =>
        expect(lastQuery()).toEqual({
          deviceType: 'solar_home_system',
          provider: 'paystack_transaction',
          status: '0',
          serial_number: '6380',
          from: '2026-10-01',
          to: '2026-10-31',
          page: '2',
          per_page: '15',
          sort_by: '-created_at',
        }),
      );
      expect(screen.getByText('Serial: 6380')).toBeInTheDocument();
      expect(screen.getByText('Provider: Paystack')).toBeInTheDocument();
      expect(screen.getByText('Device: Solar home system')).toBeInTheDocument();
      expect(screen.getByText('01 Oct 2026 – 31 Oct 2026')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove filter Processing' }));
      expect(router.state.location.search).not.toHaveProperty('status');
      expect(router.state.location.search).not.toHaveProperty('page');

      await user.click(screen.getByRole('button', { name: 'Clear all' }));
      expect(router.state.location.search).toEqual({});
    });

    it('narrows the list from the filter controls', async () => {
      const { lastQuery } = transactionListHandlers();
      const { user, router } = renderApp('/transactions');

      await screen.findByRole('table', { name: 'Transactions' });
      await user.selectOptions(screen.getByLabelText('Status'), 'Rejected');
      await user.selectOptions(
        screen.getByLabelText('Provider'),
        await screen.findByRole('option', { name: 'Cash' }),
      );
      await user.selectOptions(screen.getByLabelText('Device type'), 'Meter');
      await user.type(screen.getByLabelText('From'), '2026-10-01');
      await user.type(screen.getByLabelText('To'), '2026-10-05');
      await user.type(screen.getByRole('searchbox', { name: 'Device serial' }), 'SN-9');

      await waitFor(() =>
        expect(router.state.location.search).toEqual({
          status: 'rejected',
          provider: 'cash_transaction',
          device: 'meter',
          from: '2026-10-01',
          to: '2026-10-05',
          serial: 'SN-9',
        }),
      );
      await waitFor(() =>
        expect(lastQuery()).toMatchObject({ status: '-1', serial_number: 'SN-9' }),
      );
      expect(screen.getByText('01 Oct 2026 – 05 Oct 2026')).toBeInTheDocument();
    });

    it('keeps a provider from the URL selectable even when the list does not have it', async () => {
      transactionListHandlers({ providers: [] });
      renderApp('/transactions?provider=wavecom_transaction&from=2026-10-01');

      expect(await screen.findByRole('option', { name: 'Wavecom' })).toBeInTheDocument();
      expect(screen.getByText('From 01 Oct 2026')).toBeInTheDocument();
    });

    it('opens the filters on phones from a toggle that counts them', async () => {
      transactionListHandlers();
      const { user } = renderApp('/transactions?status=confirmed&to=2026-10-05');

      const toggle = await screen.findByRole('button', { name: 'Filters · 2' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Until 05 Oct 2026')).toBeInTheDocument();
    });

    it('offers to clear filters that match nothing', async () => {
      transactionListHandlers({ rows: [] });
      const { user, router } = renderApp('/transactions?status=cancelled');

      expect(await screen.findByText('No transactions match these filters.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(router.state.location.search).toEqual({});
      expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();
    });
  });

  it('sorts by a column and flips the direction on a second click', async () => {
    const { lastQuery } = transactionListHandlers();
    const { user, router } = renderApp('/transactions');

    await screen.findByRole('table', { name: 'Transactions' });
    await user.click(within(table()).getByRole('button', { name: 'Amount' }));
    expect(router.state.location.search).toEqual({ sort: 'amount' });
    await waitFor(() => expect(lastQuery()?.sort_by).toBe('amount'));
    expect(within(table()).getByRole('columnheader', { name: 'Amount' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(within(table()).getByRole('button', { name: 'Amount' }));
    expect(router.state.location.search).toEqual({ sort: '-amount' });

    expect(within(table()).getByRole('columnheader', { name: 'Amount' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    for (const [column, sort] of [
      ['Provider', 'original_transaction_type'],
      ['Sender', 'sender'],
      ['Date', 'created_at'],
    ]) {
      await user.click(within(table()).getByRole('button', { name: column }));
      expect(router.state.location.search).toEqual({ sort });
    }
  });

  it('pages through the list and changes the page size', async () => {
    transactionListHandlers({ total: 40 });
    const { user, router } = renderApp('/transactions');

    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(router.state.location.search).toEqual({ page: 2 });
    await user.click(await screen.findByRole('button', { name: 'Previous page' }));
    expect(router.state.location.search).toEqual({});
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(router.state.location.search).toEqual({ per_page: 50 });
    await user.selectOptions(screen.getByLabelText('Rows per page'), '15');
    expect(router.state.location.search).toEqual({});
  });

  it('explains why the list did not load', async () => {
    transactionListHandlers();
    server.use(
      http.get('/api/transactions/advanced', () =>
        HttpResponse.json({ message: 'Database is down' }, { status: 500 }),
      ),
    );
    renderApp('/transactions');

    expect(
      await screen.findByText('Could not load transactions: Database is down'),
    ).toBeInTheDocument();
  });

  it('opens a payment from its row and closes it again, keeping the filters', async () => {
    transactionListHandlers();
    server.use(
      http.get('/api/transactions/501', () =>
        HttpResponse.json({ data: transactionDetailFixture({ id: 501 }) }),
      ),
    );
    const { user, router } = renderApp('/transactions?status=confirmed');

    const row = await within(await screen.findByRole('table', { name: 'Transactions' })).findByRole(
      'row',
      { name: /Amina Bello/ },
    );
    await user.click(within(row).getByText('Installment'));
    expect(router.state.location.search).toEqual({ status: 'confirmed', transaction: 501 });
    expect(await screen.findByRole('dialog')).toHaveTextContent('Transaction #501');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(router.state.location.search).toEqual({ status: 'confirmed' });

    await user.click(within(row).getByRole('link', { name: 'Open transaction 501' }));
    expect(router.state.location.search).toEqual({ status: 'confirmed', transaction: 501 });
  });

  it('leaves the row alone when the customer link is clicked', async () => {
    transactionListHandlers();
    server.use(
      http.get('/api/people/7', () => HttpResponse.json({ message: 'Not here' }, { status: 404 })),
    );
    const { user, router } = renderApp('/transactions');

    const row = await within(await screen.findByRole('table', { name: 'Transactions' })).findByRole(
      'row',
      { name: /Amina Bello/ },
    );
    await user.click(within(row).getByRole('link', { name: 'Amina Bello' }));
    expect(router.state.location.pathname).toBe('/customers/7');
  });

  describe('export', () => {
    it('is hidden without the exports permission', async () => {
      transactionListHandlers();
      renderApp('/transactions');

      await screen.findByRole('table', { name: 'Transactions' });
      expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    });

    it('downloads a CSV of the filtered list under the server file name', async () => {
      signIn({ permissions: [...ALL_PERMISSIONS, 'exports'] });
      transactionListHandlers();
      const exportQueries: Record<string, string>[] = [];
      server.use(
        http.get('/api/export/transactions', ({ request }) => {
          exportQueries.push(Object.fromEntries(new URL(request.url).searchParams));
          return new HttpResponse('x', {
            headers: { 'Content-Disposition': 'attachment; filename=transactions.csv' },
          });
        }),
      );
      URL.createObjectURL = vi.fn(() => 'blob:export');
      URL.revokeObjectURL = vi.fn();
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download);
      });
      const { user } = renderApp(
        '/transactions?provider=cash_transaction&status=confirmed&serial=SN-1&from=2026-10-01&page=3&sort=amount',
      );

      await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

      await waitFor(() => expect(downloads).toEqual(['transactions.csv']));
      expect(exportQueries).toEqual([
        {
          format: 'csv',
          provider: 'cash_transaction',
          status: '1',
          serial_number: 'SN-1',
          from: '2026-10-01',
        },
      ]);
    });

    it('shows why an export failed', async () => {
      signIn({ permissions: [...ALL_PERMISSIONS, 'exports'] });
      transactionListHandlers();
      server.use(
        http.get('/api/export/transactions', () =>
          HttpResponse.json({ message: 'Nothing to export.' }, { status: 422 }),
        ),
      );
      const { user } = renderApp('/transactions');

      await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

      expect(await screen.findByText('The export failed: Nothing to export.')).toBeInTheDocument();
    });
  });
});
