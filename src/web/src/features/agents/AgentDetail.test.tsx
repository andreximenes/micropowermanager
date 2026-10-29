import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { balanceEntryLabel, commissionCredited } from './labels';

import { paginator, signIn } from '@/test/fixtures';
import { agentFixture, agentHandlers } from '@/test/agentFixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const panel = () => screen.getByRole('dialog');
const section = () => screen.findByRole('table');

async function openAgent(path = '/agents/4') {
  const view = renderApp(path);
  await screen.findByRole('heading', { name: 'Musa Ibrahim', level: 1 });
  return view;
}

describe('AgentDetail', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows who the agent is, what they owe and their commission', async () => {
    agentHandlers();
    server.use(
      http.get('/api/agents/balance/history/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 1,
              amount: 10000,
              available_balance: 42500,
              trigger_type: 'agent_transaction',
              created_at: '2026-10-28T08:00:00.000000Z',
            },
            {
              id: 2,
              amount: -120000,
              available_balance: 32500,
              trigger_type: 'agent_receipt',
              created_at: '2026-10-21T08:00:00.000000Z',
            },
          ]),
        ),
      ),
    );
    await openAgent();

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('+2348034102276')).toBeInTheDocument();
    expect(screen.getByText('Agent since Mar 2025')).toBeInTheDocument();
    expect(screen.getByText('TZS 42,500')).toBeInTheDocument();
    expect(screen.getByText('TZS 2,000')).toBeInTheDocument();
    const changes = await screen.findByRole('list', { name: 'Latest balance changes' });
    expect(changes).toHaveTextContent('Payment collected');
    expect(changes).toHaveTextContent('+TZS 10,000');
    expect(changes).toHaveTextContent('Money handed in');
    expect(changes).toHaveTextContent('TZS -120,000');
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('2.5%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sold products/ })).toHaveTextContent('9');
  });

  it('says when the agent cannot load', async () => {
    agentHandlers();
    server.use(
      http.get('/api/agents/9', () => HttpResponse.json({ message: 'Not found' }, { status: 404 })),
    );
    renderApp('/agents/9');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this agent: Not found',
    );
  });

  it('assigns a product at the agent price and removes one', async () => {
    agentHandlers();
    const assigned: unknown[] = [];
    let removed = false;
    server.use(
      http.get('/api/agents/assigned/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 70,
              cost: 96000,
              created_at: '2025-03-12T08:00:00.000000Z',
              appliance: { id: 9, name: 'Spark Lite Kit' },
            },
          ]),
        ),
      ),
      http.post('/api/agents/assigned', async ({ request }) => {
        assigned.push(await request.json());
        return HttpResponse.json({ data: {} }, { status: 201 });
      }),
      http.delete('/api/agents/assigned/70', () => {
        removed = true;
        return HttpResponse.json({ message: 'Removed' });
      }),
    );
    const { user } = await openAgent();

    const row = within(await section()).getByRole('row', { name: /Spark Lite Kit/ });
    expect(row).toHaveTextContent('TZS 96,000');
    expect(row).toHaveTextContent('TZS 2,400 per sale');
    expect(row).toHaveTextContent('12 Mar 2025');

    const form = screen.getByRole('form', { name: 'Assign a product' });
    await user.selectOptions(within(form).getByRole('combobox'), 'Spark Steady Kit');
    expect(within(form).getByRole('textbox')).toHaveValue('144000');
    await user.clear(within(form).getByRole('textbox'));
    await user.type(within(form).getByRole('textbox'), '140000');
    await user.click(within(form).getByRole('button', { name: 'Assign' }));
    await waitFor(() =>
      expect(assigned).toEqual([{ agent_id: 4, user_id: 1, appliance_id: 8, cost: 140000 }]),
    );

    await user.click(within(row).getByRole('button', { name: 'Remove Spark Lite Kit' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove product' }),
    );
    await waitFor(() => expect(removed).toBe(true));
  });

  it('shows why a product was not assigned', async () => {
    agentHandlers();
    server.use(
      http.post('/api/agents/assigned', () =>
        HttpResponse.json({ message: 'Already assigned' }, { status: 409 }),
      ),
    );
    const { user } = await openAgent();

    const form = screen.getByRole('form', { name: 'Assign a product' });
    await within(form).findByRole('option', { name: 'Spark Steady Kit' });
    await user.selectOptions(within(form).getByRole('combobox'), 'Spark Steady Kit');
    await user.click(within(form).getByRole('button', { name: 'Assign' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'The product was not assigned: Already assigned',
    );
  });

  it('lists sales, receipts, balance and commission history, transactions and tickets', async () => {
    agentHandlers();
    server.use(
      http.get('/api/agents/sold/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 21,
              total_cost: 144000,
              created_at: '2026-10-20T08:00:00.000000Z',
              person: { id: 7, name: 'Blessing', surname: 'Danjuma' },
              appliance: { name: 'Spark Steady Kit' },
            },
          ]),
        ),
      ),
      http.get('/api/agents/receipt/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 3,
              amount: 120000,
              created_at: '2026-10-21T08:00:00.000000Z',
              user: { name: 'Grace Admin' },
            },
          ]),
        ),
      ),
      http.get('/api/agents/balance/history/4', ({ request }) =>
        new URL(request.url).searchParams.get('type') === 'commission'
          ? HttpResponse.json(
              paginator([
                {
                  id: 9,
                  amount: 3600,
                  available_balance: 3600,
                  trigger_type: 'agent_commission',
                  created_at: '2026-10-20T08:00:00.000000Z',
                },
              ]),
            )
          : HttpResponse.json(paginator([])),
      ),
      http.get('/api/agents/transactions/4', () =>
        HttpResponse.json(
          paginator(
            [
              {
                id: 384,
                amount: 4310,
                type: 'energy',
                created_at: '2026-10-09T00:00:00.000000Z',
                device: {
                  device_serial: 'SN-1',
                  person: { id: 7, name: 'Alyce', surname: 'Marvin' },
                },
              },
            ],
            { total: 31 },
          ),
        ),
      ),
      http.get('/api/tickets/agents/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 12,
              title: 'Customer wants a refund',
              status: 1,
              created_at: '2026-10-02T08:00:00.000000Z',
              owner: { id: 7, name: 'Alyce', surname: 'Marvin' },
            },
            { id: 13, title: 'Panel loose', status: 0, created_at: null, owner: null },
          ]),
        ),
      ),
    );
    const { user } = await openAgent();
    const tab = (name: RegExp) =>
      user.click(
        within(screen.getByRole('navigation', { name: 'Agent sections' })).getByRole('link', {
          name,
        }),
      );

    await tab(/Sold products/);
    const sale = within(await section()).getByRole('row', { name: /Spark Steady Kit/ });
    expect(within(sale).getByRole('link', { name: 'Blessing Danjuma' })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(within(sale).getByRole('link', { name: 'Contract #21' })).toHaveAttribute(
      'href',
      '/contracts/21',
    );

    await tab(/Receipts/);
    expect(await within(await section()).findByText('Grace Admin')).toBeInTheDocument();

    await tab(/Balance history/);
    await waitFor(() => expect(screen.getAllByText('No balance changes yet.')).toHaveLength(2));

    await tab(/Commission history/);
    expect(await within(await section()).findByText('Commission earned')).toBeInTheDocument();

    await tab(/Transactions/);
    expect(await within(await section()).findByText('Energy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await tab(/Tickets/);
    const tickets = await section();
    expect(
      await within(tickets).findByRole('link', { name: 'Customer wants a refund' }),
    ).toHaveAttribute('href', '/tickets?ticket=12&status=closed');
    expect(within(tickets).getByText('Open')).toBeInTheDocument();
  });

  it('shows records without customer links to users who cannot open customers', async () => {
    signIn({ permissions: ['tickets'] });
    agentHandlers();
    server.use(
      http.get('/api/agents/sold/4', () =>
        HttpResponse.json(
          paginator([
            {
              id: 21,
              total_cost: 144000,
              created_at: null,
              person: { id: 7, name: 'Blessing', surname: 'Danjuma' },
            },
          ]),
        ),
      ),
      http.get('/api/agents/receipt/4', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    const { user } = await openAgent('/agents/4?tab=sold');

    expect(await within(await section()).findByText('Blessing Danjuma')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Blessing Danjuma' })).not.toBeInTheDocument();
    expect(screen.getByText('#21')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Receipts/ }));
    expect(await screen.findByText('Could not load receipts: Forbidden')).toBeInTheDocument();
  });

  it('records a receipt, crediting the commission when the agent settles all they owe', async () => {
    agentHandlers();
    const receipts: unknown[] = [];
    server.use(
      http.post('/api/agents/receipt', async ({ request }) => {
        receipts.push(await request.json());
        return HttpResponse.json({ data: {} }, { status: 201 });
      }),
    );
    const { user } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'Add receipt' }));
    const amount = within(panel()).getByRole('textbox', { name: 'Amount collected (TZS) *' });
    expect(amount).toHaveValue('42500');
    expect(panel()).toHaveTextContent('Commission credited− TZS 2,000');
    expect(panel()).toHaveTextContent('Cash to receiveTZS 40,500');

    await user.clear(amount);
    await user.type(amount, '50000');
    await user.click(within(panel()).getByRole('button', { name: 'Receive money' }));
    expect(
      await within(panel()).findByText('The agent owes TZS 42,500; a receipt cannot be for more.'),
    ).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '20000');
    expect(panel()).toHaveTextContent('Commission credited− TZS 0');
    await user.click(within(panel()).getByRole('button', { name: 'Receive money' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(receipts).toEqual([{ agent_id: 4, amount: 20000 }]);
  });

  it('explains that no receipt is due when the agent owes nothing', async () => {
    agentHandlers({ agent: agentFixture({ balance: -3000 }) });
    const { user } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'Add receipt' }));

    expect(panel()).toHaveTextContent(
      'This agent does not owe the company anything. The company owes the agent TZS 3,000. Pending commission of TZS 2,000 cannot be settled through a receipt.',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Done' }));
  });

  it('adds balance and shows why it failed', async () => {
    agentHandlers();
    const charges: unknown[] = [];
    server.use(
      http.post('/api/agents/charge', async ({ request }) => {
        charges.push(await request.json());
        return charges.length === 1
          ? HttpResponse.json({ message: 'Database busy' }, { status: 500 })
          : HttpResponse.json({ data: {} }, { status: 201 });
      }),
    );
    const { user } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'Add balance' }));
    await user.click(within(panel()).getByRole('button', { name: 'Add balance' }));
    expect(await within(panel()).findByText('Enter an amount, e.g. 25000.')).toBeInTheDocument();
    await user.type(within(panel()).getByRole('textbox', { name: 'Amount (TZS) *' }), '0');
    await user.click(within(panel()).getByRole('button', { name: 'Add balance' }));
    expect(await within(panel()).findByText('Enter more than 0.')).toBeInTheDocument();

    await user.clear(within(panel()).getByRole('textbox', { name: 'Amount (TZS) *' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Amount (TZS) *' }), '25000');
    await user.click(within(panel()).getByRole('button', { name: 'Add balance' }));
    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The balance was not added: Database busy',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Add balance' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(charges).toEqual([
      { agent_id: 4, amount: 25000 },
      { agent_id: 4, amount: 25000 },
    ]);
  });

  it('edits the agent without touching their sign-in', async () => {
    agentHandlers();
    const updates: unknown[] = [];
    server.use(
      http.put('/api/agents/4', async ({ request }) => {
        updates.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(within(panel()).queryByRole('textbox', { name: 'E-mail *' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('textbox', { name: 'Phone number' })).toHaveValue(
      '8034102276',
    );
    await user.clear(within(panel()).getByRole('textbox', { name: 'Last name *' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Last name *' }), 'Bello');
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Gender' }), '');
    await user.click(within(panel()).getByRole('button', { name: 'Save agent' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updates).toEqual([
      {
        name: 'Musa',
        surname: 'Bello',
        miniGridId: 2,
        commissionTypeId: 1,
        birthday: '1990-04-02',
        phone: '+2348034102276',
      },
    ]);
  });

  it('changes the password after checking both entries match', async () => {
    agentHandlers();
    const passwords: unknown[] = [];
    server.use(
      http.put('/api/agents/4/password', async ({ request }) => {
        passwords.push(await request.json());
        return passwords.length === 1
          ? HttpResponse.json({ message: 'Too weak' }, { status: 422 })
          : HttpResponse.json({ data: { message: 'Password updated successfully' } });
      }),
    );
    const { user } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change password' }));
    await user.type(within(panel()).getByLabelText('New password *'), 'secret1');
    await user.type(within(panel()).getByLabelText('Repeat the password *'), 'secret2');
    await user.click(within(panel()).getByRole('button', { name: 'Change password' }));
    expect(await within(panel()).findByText('The passwords do not match.')).toBeInTheDocument();

    await user.clear(within(panel()).getByLabelText('Repeat the password *'));
    await user.type(within(panel()).getByLabelText('Repeat the password *'), 'secret1');
    await user.click(within(panel()).getByRole('button', { name: 'Change password' }));
    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The password was not changed: Too weak',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(passwords.at(-1)).toEqual({ password: 'secret1', password_confirmation: 'secret1' });
  });

  it('deletes the agent, and reports a refusal the endpoint puts in its body', async () => {
    agentHandlers();
    let attempts = 0;
    server.use(
      http.delete('/api/agents/4', () => {
        attempts += 1;
        return HttpResponse.json({
          data:
            attempts === 1
              ? { message: 'Failed to delete agent', status_code: 400 }
              : { message: 'Agent deleted successfully', status_code: 200 },
        });
      }),
    );
    const { user, router } = await openAgent();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete agent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Musa Ibrahim?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete agent' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The agent was not deleted: Failed to delete agent',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Delete agent' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/agents'));
  });
});

describe('agent labels', () => {
  it('names balance changes, falling back to the raw trigger', () => {
    expect(balanceEntryLabel('agent_charge')).toBe('Balance added');
    expect(balanceEntryLabel('agent_appliance')).toBe('Product sold');
    expect(balanceEntryLabel('something_else')).toBe('Something else');
  });

  it('credits commission only when the agent settles everything they owe', () => {
    expect(commissionCredited(0, 100, 10)).toBe(0);
    expect(commissionCredited(50, 0, 10)).toBe(0);
    expect(commissionCredited(99.99, 100, 10)).toBe(0);
    expect(commissionCredited(100, 100, 10)).toBe(10);
    expect(commissionCredited(5, 5, 10)).toBe(5);
  });
});
