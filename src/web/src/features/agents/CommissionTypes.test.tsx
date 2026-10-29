import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { signIn } from '@/test/fixtures';
import { agentHandlers } from '@/test/agentFixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const panel = () => screen.getByRole('dialog');

describe('CommissionTypes', () => {
  beforeEach(() => {
    signIn();
    agentHandlers();
  });

  it('lists commission types as percentages, and adds one', async () => {
    const created: unknown[] = [];
    server.use(
      http.post('/api/agents/commissions', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: {} }, { status: 201 });
      }),
    );
    const { user } = renderApp('/agents/commissions');

    const row = within(await screen.findByRole('table', { name: 'Commission types' })).getByRole(
      'row',
      { name: /Standard/ },
    );
    expect(row).toHaveTextContent('5%');
    expect(row).toHaveTextContent('2.5%');
    expect(row).toHaveTextContent('TZS 10,000');

    await user.click(screen.getByRole('button', { name: '+ New commission type' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Senior');
    await user.type(
      within(panel()).getByRole('textbox', { name: 'On energy payments (%) *' }),
      '120',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Save commission type' }));
    expect(await within(panel()).findByText('Enter at most 100.')).toBeInTheDocument();
    expect(within(panel()).getByText('Enter an amount, e.g. 10000.')).toBeInTheDocument();

    await user.clear(within(panel()).getByRole('textbox', { name: 'On energy payments (%) *' }));
    await user.type(
      within(panel()).getByRole('textbox', { name: 'On energy payments (%) *' }),
      '7.5',
    );
    await user.type(within(panel()).getByRole('textbox', { name: 'On product sales (%) *' }), '3');
    await user.type(within(panel()).getByRole('textbox', { name: 'Risk balance (TZS) *' }), '5000');
    await user.click(within(panel()).getByRole('button', { name: 'Save commission type' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(created).toEqual([
      { name: 'Senior', energy_commission: 0.075, appliance_commission: 0.03, risk_balance: 5000 },
    ]);
  });

  it('edits and deletes a commission type, showing a refusal', async () => {
    const updates: unknown[] = [];
    server.use(
      http.put('/api/agents/commissions/1', async ({ request }) => {
        updates.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
      http.delete('/api/agents/commissions/1', () =>
        HttpResponse.json({ message: 'Agents still use it' }, { status: 409 }),
      ),
    );
    const { user } = renderApp('/agents/commissions');

    await user.click(await screen.findByRole('button', { name: 'Edit Standard' }));
    expect(within(panel()).getByRole('textbox', { name: 'On product sales (%) *' })).toHaveValue(
      '2.5',
    );
    await user.clear(within(panel()).getByRole('textbox', { name: 'Name *' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Basic');
    await user.click(within(panel()).getByRole('button', { name: 'Save commission type' }));
    await waitFor(() =>
      expect(updates).toEqual([
        {
          name: 'Basic',
          energy_commission: 0.05,
          appliance_commission: 0.025,
          risk_balance: 10000,
        },
      ]),
    );

    await user.click(screen.getByRole('button', { name: 'Delete Standard' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Standard?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete commission type' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The commission type was not deleted: Agents still use it',
    );
  });

  it('says when there are none yet', async () => {
    server.use(http.get('/api/agents/commissions', () => HttpResponse.json({ data: [] })));
    renderApp('/agents/commissions');
    expect(
      await screen.findByText('No commission types yet. Agents need one, so add the first.'),
    ).toBeInTheDocument();
  });

  it('reports a load failure and a refused save', async () => {
    server.use(
      http.get('/api/agents/commissions', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
      http.post('/api/agents/commissions', () =>
        HttpResponse.json(
          { message: 'Invalid.', errors: { risk_balance: ['Must be at least 0.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/agents/commissions');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load commission types: Forbidden',
    );
    await user.click(screen.getByRole('button', { name: '+ New commission type' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'X');
    await user.type(
      within(panel()).getByRole('textbox', { name: 'On energy payments (%) *' }),
      '1',
    );
    await user.type(within(panel()).getByRole('textbox', { name: 'On product sales (%) *' }), '1');
    await user.type(within(panel()).getByRole('textbox', { name: 'Risk balance (TZS) *' }), '0');
    await user.click(within(panel()).getByRole('button', { name: 'Save commission type' }));
    expect(await within(panel()).findByText('Must be at least 0.')).toBeInTheDocument();
  });
});
