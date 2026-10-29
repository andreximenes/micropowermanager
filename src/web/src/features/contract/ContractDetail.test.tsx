import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import {
  contractDetailFixture,
  contractHandlers,
  energyContractFixture,
  logFixture,
  paginated,
  rateInput,
} from '@/test/contractFixtures';
import { ALL_PERMISSIONS, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const heading = () => screen.findByRole('heading', { level: 1, name: 'Solar Kit' });

/** A KPI card is its label followed by the value and hint. */
function kpi(label: string) {
  const card = screen.getByText(label, { selector: 'div' }).parentElement;
  if (!card) {
    throw new Error(`No KPI labelled ${label}`);
  }
  return card;
}

const table = () => within(screen.getByRole('table', { name: 'Payment schedule' }));
const bodyRows = () => table().getAllByRole('row').slice(1);

/** Serves the contract from a variable, so a test can change what the next fetch returns. */
function liveContract(initial: ReturnType<typeof contractDetailFixture>) {
  const state = { contract: initial };
  server.use(...contractHandlers({ contract: initial }));
  server.use(
    http.get('/api/appliances/person/people/detail/21', () =>
      HttpResponse.json({ data: state.contract }),
    ),
  );
  return state;
}

describe('ContractDetail', () => {
  beforeEach(() => {
    signIn({ permissions: [...ALL_PERMISSIONS, 'payments'] });
  });

  it('shows a loading state, then the contract header', async () => {
    server.use(...contractHandlers());
    renderApp('/contracts/21');

    expect(await screen.findByText('Loading contract…')).toBeInTheDocument();
    await heading();
    await vi.waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
        'Customers / Amina Okafor / Solar Kit',
      ),
    );
    expect(screen.getAllByRole('link', { name: 'Amina Okafor' })[0]).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(screen.getByText('Overdue', { selector: 'h1 + span' })).toBeInTheDocument();
    expect(screen.getByText('Installments · 4 monthly')).toBeInTheDocument();
    expect(screen.getByText('Sold 01 Feb 2020')).toBeInTheDocument();
    expect(screen.getByText('Serial SN-100')).toBeInTheDocument();
  });

  it('reports a contract that cannot be loaded', async () => {
    server.use(
      http.get('/api/appliances/person/people/detail/21', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    renderApp('/contracts/21');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this contract: Server Error',
    );
  });

  it('computes the KPIs from every rate of the contract', async () => {
    server.use(...contractHandlers());
    renderApp('/contracts/21');

    await heading();
    expect(kpi('Paid')).toHaveTextContent('TZS 450incl. TZS 200 down payment');
    expect(kpi('Remaining')).toHaveTextContent('TZS 750of TZS 1,200');
    expect(kpi('Next installment')).toHaveTextContent('TZS 250due 01 Apr 2020');
    expect(kpi('Paid off by')).toHaveTextContent('Feb 20993 installments to go');
  });

  it('lists the schedule with the down payment first and a status per installment', async () => {
    server.use(...contractHandlers());
    renderApp('/contracts/21');

    await heading();
    expect(screen.getByText('installments paid').parentElement).toHaveTextContent(
      '1 of 4 installments paid',
    );
    expect(screen.getByRole('progressbar', { name: 'Installments paid' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    expect(bodyRows().map((row) => row.textContent)).toEqual([
      '—01 Feb 2020TZS 200—Down payment · paid',
      '101 Mar 2020TZS 250—Paid',
      '201 Apr 2020TZS 250TZS 250Overdue',
      '301 Jan 2099TZS 250TZS 250Upcoming',
      '401 Feb 2099TZS 250TZS 250Upcoming',
    ]);
    expect(
      table()
        .getAllByRole('button', { name: /^Edit/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Edit installment 2', 'Edit installment 3', 'Edit installment 4']);
    const list = within(screen.getByRole('list', { name: 'Payment schedule list' }));
    expect(list.getAllByRole('listitem')[2]).toHaveTextContent(
      'Installment 2Overdue01 Apr 2020 · TZS 250',
    );
  });

  it('marks the next installment and how much of it is left on a phone', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({
          down_payment: 0,
          rates: [rateInput(1, 250, 100, '2099-01-01'), rateInput(2, 250, 250, '2099-02-01')],
        }),
      }),
    );
    renderApp('/contracts/21');

    await heading();
    expect(bodyRows()[0]).toHaveTextContent('101 Jan 2099TZS 250TZS 100Next');
    expect(kpi('Paid')).toHaveTextContent(/^PaidTZS 150$/);
    const list = within(screen.getByRole('list', { name: 'Payment schedule list' }));
    expect(list.getAllByRole('listitem')[0]).toHaveTextContent(
      'Installment 1Next01 Jan 2099 · TZS 250 · TZS 100 to pay',
    );
  });

  it('folds a long schedule but always shows the next installment', async () => {
    const rates = Array.from({ length: 12 }, (_, index) =>
      rateInput(
        index + 1,
        100,
        index < 8 ? 0 : 100,
        `20${index < 8 ? 20 : 99}-${String(index + 1).padStart(2, '0')}-01`,
      ),
    );
    server.use(
      ...contractHandlers({ contract: contractDetailFixture({ down_payment: 0, rates }) }),
    );
    const { user } = renderApp('/contracts/21');

    await heading();
    expect(bodyRows()).toHaveLength(10);
    expect(bodyRows()[8]).toHaveTextContent('Next');

    await user.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(bodyRows()).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /more$/ })).not.toBeInTheDocument();
  });

  it('shows a paid off contract', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({
          down_payment: 0,
          rates: [rateInput(1, 1200, 0, '2020-01-01')],
        }),
      }),
    );
    renderApp('/contracts/21');

    await heading();
    expect(screen.getByText('Paid off', { selector: 'h1 + span' })).toBeInTheDocument();
    expect(kpi('Next installment')).toHaveTextContent('—Nothing due');
    expect(kpi('Paid off by')).toHaveTextContent(/^Paid off byPaid off$/);
    expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument();
  });

  it('shows an installment contract without rates', async () => {
    server.use(...contractHandlers({ contract: contractDetailFixture({ rates: [] }) }));
    renderApp('/contracts/21');

    await heading();
    expect(screen.getByText('This contract has no installments.')).toBeInTheDocument();
    expect(kpi('Paid off by')).toHaveTextContent(/^Paid off by—$/);
    expect(screen.getByText('On track', { selector: 'h1 + span' })).toBeInTheDocument();
  });

  it('shows the device with its manufacturer and last token', async () => {
    server.use(
      ...contractHandlers({
        tokens: [
          {
            id: 1,
            token: '111',
            token_amount: 7,
            token_unit: 'days',
            created_at: '2026-09-01T00:00:00Z',
          },
          {
            id: 2,
            token: '222',
            token_amount: '30',
            token_unit: 'days',
            created_at: '2026-10-16T00:00:00Z',
          },
        ],
      }),
    );
    renderApp('/contracts/21');

    await heading();
    expect(await screen.findByText('Demo SHS Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Solar home system')).toBeInTheDocument();
    expect(screen.getByText('30 days · 16 Oct 2026')).toBeInTheDocument();
  });

  it.each([
    [[], 'None yet'],
    [[{ id: 1, token: '111', created_at: '2026-10-16T00:00:00Z' }], '16 Oct 2026'],
  ])('shows a missing or bare last token', async (tokens, text) => {
    server.use(...contractHandlers({ tokens }));
    renderApp('/contracts/21');

    await heading();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('reports device details that cannot be loaded', async () => {
    server.use(...contractHandlers());
    server.use(
      http.get('/api/solar-home-systems/:id', () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );
    renderApp('/contracts/21');

    expect(
      await screen.findByText('Could not load the device details: Not found'),
    ).toBeInTheDocument();
  });

  it('shows a device that is not a solar home system, or none at all', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({
          device: { device_type: 'meter', device_id: 4, device_serial: 'M-1' },
        }),
      }),
    );
    renderApp('/contracts/21');

    await heading();
    expect(screen.getByText('Meter')).toBeInTheDocument();
    expect(screen.queryByText('Manufacturer')).not.toBeInTheDocument();
  });

  it('says when no device is linked', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({ device: null, device_serial: null }),
      }),
    );
    renderApp('/contracts/21');

    expect(await screen.findByText('No device is linked to this contract.')).toBeInTheDocument();
  });

  it('pages through the history', async () => {
    server.use(...contractHandlers());
    server.use(
      http.get('/api/appliances/person/21/logs', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(
          page === 1
            ? paginated([logFixture({ id: 1, action: 'Newest entry' })], 1, 2)
            : paginated([logFixture({ id: 2, action: 'Oldest entry', owner: null })], 2, 2),
        );
      }),
    );
    const { user } = renderApp('/contracts/21');

    expect(await screen.findByText('Newest entry')).toBeInTheDocument();
    expect(screen.getByText('04 Mar 2026 · Grace Admin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show older history' }));

    expect(await screen.findByText('Oldest entry')).toBeInTheDocument();
    expect(screen.getByText('04 Mar 2026', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older history' })).not.toBeInTheDocument();
  });

  it('handles an empty or failing history', async () => {
    server.use(...contractHandlers({ logs: [] }));
    renderApp('/contracts/21');
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
  });

  it('reports a history that cannot be loaded', async () => {
    server.use(...contractHandlers());
    server.use(
      http.get('/api/appliances/person/21/logs', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    renderApp('/contracts/21');
    expect(await screen.findByText('Could not load the history: Server Error')).toBeInTheDocument();
  });

  describe('energy as a service', () => {
    it('shows the daily price, minimum and payments instead of a schedule', async () => {
      server.use(
        ...contractHandlers({
          contract: energyContractFixture({
            rates: [rateInput(1, 500, 0, '2026-01-01'), rateInput(2, 1000, 0, '2026-02-01')],
          }),
        }),
      );
      renderApp('/contracts/21');

      await heading();
      expect(screen.getByText('Energy as a service')).toBeInTheDocument();
      expect(kpi('Price per day')).toHaveTextContent('TZS 50');
      expect(kpi('Minimum payment')).toHaveTextContent('TZS 500');
      expect(kpi('Paid')).toHaveTextContent('TZS 1,500');
      expect(kpi('Last payment')).toHaveTextContent('TZS 1,00001 Feb 2026');
      expect(screen.getByText('· covers 20 days')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument();
    });

    it('can take a first payment on a contract with no rates yet', async () => {
      server.use(
        ...contractHandlers({
          contract: energyContractFixture({ price_per_day: null, minimum_payable_amount: null }),
        }),
      );
      const { user } = renderApp('/contracts/21');

      await heading();
      expect(screen.getByText('No payments yet.')).toBeInTheDocument();
      expect(kpi('Last payment')).toHaveTextContent('—No payments yet');
      expect(kpi('Price per day')).toHaveTextContent('TZS 0');

      await user.click(screen.getByRole('button', { name: 'Record payment' }));
      expect(await screen.findByRole('dialog', { name: 'Record payment' })).toBeInTheDocument();
    });
  });

  describe('permissions', () => {
    it('hides payments from users without the payments permission', async () => {
      signIn({ permissions: ALL_PERMISSIONS });
      server.use(...contractHandlers());
      renderApp('/contracts/21');

      await heading();
      expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change plan' })).toBeInTheDocument();
    });

    it('names no customer for users who cannot see customers', async () => {
      signIn({ permissions: ['appliances'] });
      server.use(...contractHandlers());
      renderApp('/contracts/21');

      await heading();
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
        'Customers / Customer / Solar Kit',
      );
    });

    it('leaves a contract read-only without the appliances permission', async () => {
      signIn({ permissions: ['customers', 'payments'] });
      server.use(...contractHandlers());
      renderApp('/contracts/21');

      await heading();
      expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeInTheDocument();
    });
  });

  it('shows a deleted contract read-only', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({ deleted_at: '2026-05-02T08:00:00.000000Z' }),
      }),
    );
    renderApp('/contracts/21');

    await heading();
    expect(screen.getByRole('status')).toHaveTextContent(
      'This contract was deleted on 02 May 2026. It is shown read-only.',
    );
    expect(screen.getByText('Deleted', { selector: 'h1 + span' })).toBeInTheDocument();
    for (const name of ['Change plan', 'Record payment', 'More actions']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it('deletes the contract after confirmation and shows it as deleted', async () => {
    const state = liveContract(contractDetailFixture());
    const deletions: string[] = [];
    server.use(
      http.delete('/api/appliances/person/21', ({ request }) => {
        deletions.push(request.url);
        state.contract = contractDetailFixture({ deleted_at: '2026-05-02T08:00:00.000000Z' });
        return HttpResponse.json({ data: state.contract });
      }),
    );
    const { user } = renderApp('/contracts/21');

    await heading();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete contract' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete this contract?' }));
    expect(dialog.getByText(/Device SN-100 is released from the customer/)).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Delete contract' }));

    expect(await screen.findByText(/This contract was deleted on 02 May 2026/)).toBeInTheDocument();
    expect(deletions).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the contract when deleting fails or is cancelled', async () => {
    server.use(
      ...contractHandlers({
        contract: contractDetailFixture({ device_serial: null, appliance: null }),
      }),
      http.delete('/api/appliances/person/21', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/contracts/21');

    await screen.findByRole('heading', { level: 1, name: 'Product' });
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete contract' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByText(/is released/)).not.toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Delete contract' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'The contract was not deleted: Server Error',
    );

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('editing an installment', () => {
    it('saves a new amount and refreshes the contract and the customer', async () => {
      const state = liveContract(contractDetailFixture());
      const updates: unknown[] = [];
      server.use(
        http.put('/api/appliances/rates/:rateId', async ({ request, params }) => {
          updates.push({ rateId: params.rateId, body: await request.json() });
          state.contract = contractDetailFixture({
            total_cost: 1250,
            rates: [
              ...state.contract.rates.filter((rate) => rate.id !== 3),
              rateInput(3, 300, 300, '2099-01-01'),
            ],
          });
          return HttpResponse.json({ data: {} });
        }),
      );
      const { user, queryClient } = renderApp('/contracts/21');
      queryClient.setQueryData(['payments', 7], { data: [] });

      await heading();
      await user.click(table().getByRole('button', { name: 'Edit installment 3' }));
      const dialog = within(await screen.findByRole('dialog', { name: 'Edit installment 3' }));
      expect(dialog.getByText(/Due 01 Jan 2099/)).toBeInTheDocument();
      await user.clear(dialog.getByRole('textbox', { name: 'Amount (TZS)' }));
      await user.type(dialog.getByRole('textbox', { name: 'Amount (TZS)' }), '300');
      await user.click(dialog.getByRole('button', { name: 'Save TZS 300' }));

      await vi.waitFor(() => expect(kpi('Remaining')).toHaveTextContent('TZS 800of TZS 1,250'));
      expect(updates).toEqual([{ rateId: '3', body: { newCost: 300 } }]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(queryClient.getQueryState(['payments', 7])?.isInvalidated).toBe(true);
    });

    it('removes an installment set to 0 and refuses invalid amounts', async () => {
      server.use(...contractHandlers());
      const { user } = renderApp('/contracts/21');

      await heading();
      await user.click(table().getByRole('button', { name: 'Edit installment 4' }));
      const dialog = within(await screen.findByRole('dialog'));
      const amount = dialog.getByRole('textbox', { name: 'Amount (TZS)' });

      await user.clear(amount);
      await user.type(amount, '-5');
      expect(dialog.getByRole('alert')).toHaveTextContent('Enter a whole amount of 0 or more.');
      expect(dialog.getByRole('button', { name: 'Save TZS -5' })).toBeDisabled();

      await user.clear(amount);
      await user.type(amount, '0');
      expect(dialog.getByRole('button', { name: 'Remove installment' })).toBeEnabled();

      await user.click(dialog.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows why the backend refused the change', async () => {
      server.use(
        ...contractHandlers(),
        http.put('/api/appliances/rates/:rateId', () =>
          HttpResponse.json(
            {
              message: 'Cannot modify a rate that has been paid or partially paid',
              errors: { rate: ['Cannot modify a rate that has been paid or partially paid'] },
            },
            { status: 422 },
          ),
        ),
      );
      const { user } = renderApp('/contracts/21');

      await heading();
      await user.click(table().getByRole('button', { name: 'Edit installment 2' }));
      const dialog = within(await screen.findByRole('dialog'));
      await user.click(dialog.getByRole('button', { name: 'Save TZS 250' }));

      expect(await dialog.findByRole('alert')).toHaveTextContent(
        'The installment was not changed: Cannot modify a rate that has been paid or partially paid',
      );
    });
  });

  it('closes the installment and delete dialogs with Escape', async () => {
    server.use(...contractHandlers());
    const { user } = renderApp('/contracts/21');

    await heading();
    await user.click(table().getByRole('button', { name: 'Edit installment 3' }));
    await screen.findByRole('dialog', { name: 'Edit installment 3' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete contract' }));
    await screen.findByRole('dialog', { name: 'Delete this contract?' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens and closes the change plan and record payment panels', async () => {
    server.use(...contractHandlers());
    const { user } = renderApp('/contracts/21');

    await heading();
    await user.click(screen.getByRole('button', { name: 'Change plan' }));
    expect(await screen.findByRole('dialog', { name: 'Change plan' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByRole('dialog', { name: 'Record payment' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
