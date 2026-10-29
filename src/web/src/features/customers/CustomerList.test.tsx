import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import type { ListedPerson } from '@/api/people';
import { ALL_PERMISSIONS, listedPersonFixture, paginator, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

type ListData = { rows?: ListedPerson[]; total?: number; overdue?: number; perPage?: number };

/** Answers the list's requests and records the query of every page request. */
function listHandlers({
  rows = [listedPersonFixture()],
  total = rows.length,
  overdue = 0,
  perPage = 15,
}: ListData = {}) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get('/api/people', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      if (query.per_page === '1') {
        return HttpResponse.json(paginator([], { total: query.overdue === '1' ? overdue : 250 }));
      }
      queries.push(query);
      return HttpResponse.json(paginator(rows, { page: Number(query.page ?? 1), perPage, total }));
    }),
    http.get('/api/agents', () =>
      HttpResponse.json(paginator([{ id: 4, person: { name: 'Musa', surname: 'Ibrahim' } }])),
    ),
    http.get('/api/cities', () =>
      HttpResponse.json(
        paginator([
          { id: 3, name: 'Kafanchan', mini_grid: { name: "Jema'a", cluster: { name: 'Kaduna' } } },
        ]),
      ),
    ),
    http.get('/api/cities/3', () => HttpResponse.json({ data: { id: 3, name: 'Kafanchan' } })),
  );
  return { queries, lastQuery: () => queries.at(-1) };
}

const table = () => screen.getByRole('table', { name: 'Customers' });
const cards = () => screen.getByRole('list', { name: 'Customers' });

describe('CustomerList', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the totals and one row per customer with phone, village, devices, agent and last payment', async () => {
    listHandlers({ overdue: 41 });
    renderApp('/customers');

    expect(await screen.findByText('250 customers · 41 overdue')).toBeInTheDocument();
    const row = within(table()).getByRole('row', { name: /Amina Okafor/ });
    expect(row).toHaveTextContent('ID 7');
    expect(row).toHaveTextContent('+2348035550142');
    expect(row).toHaveTextContent('Kafanchan');
    expect(row).toHaveTextContent('SN-100');
    expect(row).toHaveTextContent('Musa Ibrahim');
    expect(row).toHaveTextContent('TZS 12,000 · 16 Oct 2026');
    expect(row).toHaveTextContent('Paying');
    expect(within(row).getByRole('link', { name: /Amina Okafor/ })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(screen.getByText('1–1 of 1 customer')).toBeInTheDocument();
  });

  it('shows each customer as a card for phones too, linking to the profile', async () => {
    listHandlers({
      rows: [
        listedPersonFixture({
          id: 8,
          name: 'Emeka',
          surname: 'Nwosu',
          contracts_count: 0,
          latest_payment: null,
          addresses: [],
          devices: [],
          agent_sold_appliance: null,
        }),
      ],
    });
    renderApp('/customers');

    const card = await within(await screen.findByRole('list', { name: 'Customers' })).findByRole(
      'link',
    );
    expect(card).toHaveAttribute('href', '/customers/8');
    expect(card).toHaveTextContent('Emeka Nwosu');
    expect(card).toHaveTextContent('No contract');
    expect(card).toHaveTextContent('No contact details');
    expect(card).toHaveTextContent('No payments');
    const row = within(table()).getByRole('row', { name: /Emeka Nwosu/ });
    expect(row).toHaveTextContent('—');
  });

  it('shows the status rules in the list', async () => {
    listHandlers({
      rows: [
        listedPersonFixture({ id: 1, name: 'Overdue', overdue_since: '2000-01-01' }),
        listedPersonFixture({ id: 2, name: 'Paid', outstanding_amount: 0 }),
        listedPersonFixture({ id: 3, name: 'Idle', is_active: false }),
      ],
    });
    renderApp('/customers');

    await screen.findByRole('list', { name: 'Customers' });
    expect(within(cards()).getByText(/^Overdue \d+ days$/)).toBeInTheDocument();
    expect(within(cards()).getByText('Paid off')).toBeInTheDocument();
    expect(within(cards()).getByText('Not paying')).toBeInTheDocument();
    expect(within(cards()).getAllByText(/^Last paid/)).toHaveLength(3);
  });

  it('lists only two devices and counts the rest', async () => {
    listHandlers({
      rows: [
        listedPersonFixture({
          devices: [1, 2, 3].map((id) => ({ id, device_type: 'meter', device_serial: `M-${id}` })),
        }),
      ],
    });
    renderApp('/customers');

    const row = await within(await screen.findByRole('table', { name: 'Customers' })).findByRole(
      'row',
      {
        name: /Amina/,
      },
    );
    expect(row).toHaveTextContent('M-1M-2+1');
  });

  it('applies the filters in the URL to the request and shows them as chips', async () => {
    const { lastQuery } = listHandlers();
    renderApp(
      '/customers?status=not_paying&village=3&agent=4&device=solar_home_system&overdue=true&paid_from=2026-10-01&registered_to=2026-02-01&page=2&per_page=50&sort=-city',
    );

    expect(await screen.findByText('Village: Kafanchan')).toBeInTheDocument();
    expect(await screen.findByText('Agent: Musa Ibrahim')).toBeInTheDocument();
    expect(screen.getByText('Not paying', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Device: Solar home system')).toBeInTheDocument();
    expect(screen.getByText('Overdue only')).toBeInTheDocument();
    expect(screen.getByText('Last payment: from 01 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Registered: until 01 Feb 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More filters · 4' })).toBeInTheDocument();
    expect(lastQuery()).toEqual({
      page: '2',
      per_page: '50',
      sort_by: '-city',
      active_customer: '0',
      city_id: '3',
      agent_id: '4',
      device_type: 'solar_home_system',
      overdue: '1',
      latest_payment_from: '2026-10-01',
      registration_to: '2026-02-01',
    });
    expect(screen.getByRole('combobox', { name: 'Village' })).toHaveValue('Kafanchan');
    expect(screen.getByRole('columnheader', { name: /Village/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('removes one filter, or all of them, and goes back to the first page', async () => {
    const { lastQuery } = listHandlers();
    const { user, router } = renderApp(
      '/customers?device=meter&paid_from=2026-10-01&paid_to=2026-10-20&term=Ami&page=3',
    );

    await user.click(await screen.findByRole('button', { name: 'Remove filter Device: Meter' }));
    expect(router.state.location.search).toEqual({
      paid_from: '2026-10-01',
      paid_to: '2026-10-20',
      term: 'Ami',
    });
    expect(screen.getByText('Last payment: 01 Oct 2026 – 20 Oct 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(router.state.location.search).toEqual({});
    await waitFor(() => expect(lastQuery()).toEqual({ per_page: '15', sort_by: '-created_at' }));
    expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveValue('');
  });

  it('searches as the user types, once they pause', async () => {
    const { lastQuery } = listHandlers();
    const { user, router } = renderApp('/customers?page=2');
    await screen.findByRole('table', { name: 'Customers' });

    await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), '6380');

    await waitFor(() => expect(router.state.location.search).toEqual({ term: '6380' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ term: '6380' }));
    expect(lastQuery()).not.toHaveProperty('page');

    await user.clear(screen.getByRole('searchbox', { name: 'Search customers' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('keeps the search box in step with back and forward', async () => {
    listHandlers();
    const { router } = renderApp('/customers?term=Ami');
    expect(await screen.findByRole('searchbox', { name: 'Search customers' })).toHaveValue('Ami');

    await router.navigate({ to: '/customers', search: { term: 'Bola' } });

    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveValue('Bola'),
    );
  });

  it('filters by payment status, agent and the extra filters', async () => {
    listHandlers();
    const { user, router } = renderApp('/customers');
    await screen.findByRole('table', { name: 'Customers' });

    await user.click(screen.getByRole('radio', { name: 'Paying' }));
    expect(router.state.location.search).toEqual({ status: 'paying' });
    expect(screen.getByRole('radio', { name: 'Paying' })).toHaveAttribute('aria-checked', 'true');

    await screen.findByRole('option', { name: 'Musa Ibrahim' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Agent' }), 'Musa Ibrahim');
    expect(router.state.location.search).toMatchObject({ agent: 4 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Agent' }), 'All agents');
    expect(router.state.location.search).not.toHaveProperty('agent');

    await user.click(screen.getByRole('button', { name: 'More filters' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Device type' }), 'E-bike');
    await user.click(screen.getByRole('checkbox', { name: 'Overdue only' }));
    await user.type(screen.getByLabelText('Registered from'), '2026-01-01');
    expect(router.state.location.search).toEqual({
      status: 'paying',
      device: 'e_bike',
      overdue: true,
      registered_from: '2026-01-01',
    });

    await user.click(screen.getByRole('checkbox', { name: 'Overdue only' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Device type' }), 'Any device');
    await user.clear(screen.getByLabelText('Registered from'));
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(router.state.location.search).toEqual({});
  });

  it('filters by a village found by name', async () => {
    const { lastQuery } = listHandlers();
    const { user, router } = renderApp('/customers');
    await screen.findByRole('table', { name: 'Customers' });

    await user.type(screen.getByRole('combobox', { name: 'Village' }), 'Kaf');
    await user.click(await screen.findByRole('option', { name: "Kafanchan · Jema'a · Kaduna" }));

    expect(router.state.location.search).toEqual({ village: 3 });
    await waitFor(() => expect(lastQuery()).toMatchObject({ city_id: '3' }));
    expect(await screen.findByText('Village: Kafanchan')).toBeInTheDocument();

    await user.type(screen.getByRole('combobox', { name: 'Village' }), 'x');
    expect(router.state.location.search).toEqual({});
  });

  it('sorts by a column, then the other way round', async () => {
    listHandlers();
    const { user, router } = renderApp('/customers');
    await screen.findByRole('table', { name: 'Customers' });

    await user.click(screen.getByRole('button', { name: 'Customer' }));
    expect(router.state.location.search).toEqual({ sort: 'name' });
    expect(screen.getByRole('columnheader', { name: /Customer/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: 'Customer' }));
    expect(router.state.location.search).toEqual({ sort: '-name' });

    await user.click(screen.getByRole('button', { name: 'Agent' }));
    expect(router.state.location.search).toEqual({ sort: 'agent' });
  });

  it('pages through the customers and changes the page size', async () => {
    const { lastQuery } = listHandlers({ total: 38 });
    const { user, router } = renderApp('/customers');

    expect(await screen.findByText('1–1 of 38 customers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(router.state.location.search).toEqual({ page: 2 });
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: '2' }));

    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ page: 3 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled());

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(router.state.location.search).toEqual({ page: 2 });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(router.state.location.search).toEqual({});

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    expect(router.state.location.search).toEqual({ per_page: 50 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '15');
    expect(router.state.location.search).toEqual({});
  });

  it('offers to clear the filters when nothing matches', async () => {
    listHandlers({ rows: [] });
    const { user, router } = renderApp('/customers?overdue=true');

    expect(await screen.findByText('No customers match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toEqual({});
    expect(await screen.findByText('No customers yet.')).toBeInTheDocument();
  });

  it('shows why the customers could not be loaded', async () => {
    server.use(
      http.get('/api/people', () =>
        HttpResponse.json({ message: 'Database is down.' }, { status: 500 }),
      ),
    );
    renderApp('/customers');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load customers: Database is down.',
    );
  });

  it('shows a loading state first', async () => {
    listHandlers();
    renderApp('/customers');

    expect(await screen.findByText('Loading customers…')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Customers' })).toBeInTheDocument();
  });

  describe('export', () => {
    it('is hidden without the exports permission', async () => {
      listHandlers();
      renderApp('/customers');

      await screen.findByRole('table', { name: 'Customers' });
      expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    });

    it('downloads the debts and the customer list under the server file names', async () => {
      signIn({ permissions: [...ALL_PERMISSIONS, 'exports'] });
      listHandlers();
      server.use(
        http.get(
          '/api/export/debts',
          () =>
            new HttpResponse('x', {
              headers: { 'Content-Disposition': 'attachment; filename=debts.xlsx' },
            }),
        ),
        http.get(
          '/api/export/customers',
          () =>
            new HttpResponse('x', {
              headers: { 'Content-Disposition': 'attachment; filename=customers.xlsx' },
            }),
        ),
      );
      URL.createObjectURL = vi.fn(() => 'blob:export');
      URL.revokeObjectURL = vi.fn();
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download);
      });
      const { user } = renderApp('/customers');

      await user.click(await screen.findByRole('button', { name: 'Export' }));
      await user.click(await screen.findByRole('menuitem', { name: "Customers' debts" }));
      await waitFor(() => expect(downloads).toEqual(['debts.xlsx']));

      await user.click(screen.getByRole('button', { name: 'Export' }));
      await user.click(await screen.findByRole('menuitem', { name: 'All customers' }));
      await waitFor(() => expect(downloads).toEqual(['debts.xlsx', 'customers.xlsx']));
      await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export'));
    });

    it('shows why an export failed', async () => {
      signIn({ permissions: [...ALL_PERMISSIONS, 'exports'] });
      listHandlers();
      server.use(
        http.get('/api/export/debts', () =>
          HttpResponse.json({ message: 'Nothing to export.' }, { status: 422 }),
        ),
      );
      const { user } = renderApp('/customers');

      await user.click(await screen.findByRole('button', { name: 'Export' }));
      await user.click(await screen.findByRole('menuitem', { name: "Customers' debts" }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The export failed: Nothing to export.',
      );
    });
  });
});
