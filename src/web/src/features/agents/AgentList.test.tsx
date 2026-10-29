import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { matchesTerm } from './listSearch';

import { pageOf } from '@/lib/paging';
import { signIn } from '@/test/fixtures';
import { agentFixture, agentHandlers, listedAgentFixture } from '@/test/agentFixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const table = async () => screen.findByRole('table', { name: 'Agents' });
const panel = () => screen.getByRole('dialog');

const agents = [
  listedAgentFixture(),
  listedAgentFixture({
    id: 5,
    email: 'aliyu@example.com',
    balance: -6000,
    customer_count: 38,
    sales_count: 6,
    person: { ...agentFixture().person, name: 'Aliyu', surname: 'Usman', addresses: [] },
    mini_grid: { id: 3, name: 'Zonkwa' },
  }),
  listedAgentFixture({
    id: 6,
    email: 'samuel@example.com',
    balance: 0,
    customer_count: 17,
    sales_count: 0,
    is_active: false,
    person: {
      ...agentFixture().person,
      name: 'Samuel',
      surname: 'Dogo',
      addresses: [{ id: 3, phone: '+2348029057741', is_primary: 1 }],
    },
    mini_grid: null,
  }),
];

describe('AgentList', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows totals and one row per agent with phone, site, customers, sales, balance and status', async () => {
    agentHandlers({ agents });
    renderApp('/agents');

    const rows = within(await table()).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Musa Ibrahim');
    expect(rows[1]).toHaveTextContent('+2348034102276');
    expect(rows[1]).toHaveTextContent('Kafanchan');
    expect(rows[1]).toHaveTextContent('TZS 42,500');
    expect(rows[1]).toHaveTextContent('Active');
    expect(rows[2]).toHaveTextContent('TZS -6,000');
    expect(rows[3]).toHaveTextContent('Inactive');
    expect(
      within(rows[1] as HTMLElement).getByRole('link', { name: /Musa Ibrahim/ }),
    ).toHaveAttribute('href', '/agents/4');

    const totals = screen.getByRole('region', { name: 'Totals' });
    expect(totals).toHaveTextContent('Agents3in 2 sites');
    expect(totals).toHaveTextContent('Active2');
    expect(totals).toHaveTextContent('Customers served11915 sales so far');
    expect(totals).toHaveTextContent('Due from agentsTZS 36,500');
    expect(screen.getByText('1–3 of 3 agents')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Agents' })).toBeInTheDocument();
  });

  it('searches by name or phone and filters by activity, in the URL', async () => {
    agentHandlers({ agents });
    const { user, router } = renderApp('/agents');
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Search agents' }), '0290 577');
    await waitFor(() => expect(router.state.location.search).toEqual({ term: '0290 577' }));
    expect(within(await table()).getAllByRole('row')).toHaveLength(2);
    expect(await table()).toHaveTextContent('Samuel Dogo');

    await user.clear(screen.getByRole('searchbox', { name: 'Search agents' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await user.click(screen.getByRole('radio', { name: 'Inactive' }));
    expect(within(await table()).getAllByRole('row')).toHaveLength(2);
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    expect(within(await table()).getAllByRole('row')).toHaveLength(3);
  });

  it('offers to clear a search that matches nobody', async () => {
    agentHandlers({ agents });
    const { user, router } = renderApp('/agents?term=nobody');

    await user.click(await screen.findByRole('button', { name: 'Clear search' }));
    expect(router.state.location.search).toEqual({});
  });

  it('says when there are no agents yet', async () => {
    agentHandlers({ agents: [] });
    renderApp('/agents');

    expect(await screen.findByText('No agents yet. Add the first one.')).toBeInTheDocument();
  });

  it('reports a load failure', async () => {
    agentHandlers();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({ message: 'Server down' }, { status: 500 })),
    );
    renderApp('/agents');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load agents: Server down',
    );
  });

  it('hides commission types from users without settings', async () => {
    signIn({ permissions: ['customers'] });
    agentHandlers();
    renderApp('/agents');
    await table();

    expect(screen.queryByRole('link', { name: 'Commission types' })).not.toBeInTheDocument();
  });

  it('adds an agent with the birth date, site and commission type given, then opens it', async () => {
    agentHandlers();
    const created: unknown[] = [];
    server.use(
      http.post('/api/agents', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: { id: 4 } }, { status: 201 });
      }),
    );
    const { user, router } = renderApp('/agents');
    await table();

    await user.click(screen.getByRole('button', { name: '+ New agent' }));
    await user.click(within(panel()).getByRole('button', { name: 'Save agent' }));
    expect(await within(panel()).findByText('Choose the site.')).toBeInTheDocument();
    expect(within(panel()).getByText('Enter a valid e-mail address.')).toBeInTheDocument();
    expect(within(panel()).getByText('Use at least 6 characters.')).toBeInTheDocument();

    await user.type(within(panel()).getByRole('textbox', { name: 'First name *' }), 'Joy');
    await user.type(within(panel()).getByRole('textbox', { name: 'Last name *' }), 'Okonkwo');
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'Country code' }),
      'NG +234',
    );
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Phone number' }),
      '0809 662 0137',
    );
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Gender' }), 'Female');
    await user.type(within(panel()).getByLabelText('Date of birth'), '1994-06-15');
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Site *' }), 'Zonkwa');
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'Commission type *' }),
      'Standard',
    );
    await user.type(within(panel()).getByRole('textbox', { name: 'E-mail *' }), 'joy@example.com');
    await user.type(within(panel()).getByLabelText('Password *'), 'secret1');
    await user.click(within(panel()).getByRole('button', { name: 'Save agent' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/agents/4'));
    expect(created).toEqual([
      {
        name: 'Joy',
        surname: 'Okonkwo',
        email: 'joy@example.com',
        password: 'secret1',
        phone: '+2348096620137',
        gender: 'female',
        birth_date: '1994-06-15',
        city_id: 3,
        agent_commission_id: 1,
        is_primary: 1,
        is_customer: 0,
      },
    ]);
  });

  it('says when sites or commission types cannot load', async () => {
    agentHandlers();
    server.use(
      http.get('/api/agents/commissions', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
      http.get('/api/mini-grids', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    const { user } = renderApp('/agents');
    await table();

    await user.click(screen.getByRole('button', { name: '+ New agent' }));
    expect(
      await within(panel()).findByText('Could not load commission types: Forbidden'),
    ).toBeInTheDocument();
    expect(await within(panel()).findByText('Could not load sites: Down')).toBeInTheDocument();
  });
});

describe('agent search', () => {
  const agent = listedAgentFixture();

  it('matches names, e-mail and site case-insensitively, and phone numbers by digits', () => {
    expect(matchesTerm(agent, '')).toBe(true);
    expect(matchesTerm(agent, 'musa  IBRAHIM')).toBe(true);
    expect(matchesTerm(agent, 'kafan')).toBe(true);
    expect(matchesTerm(agent, '+234 803')).toBe(true);
    expect(matchesTerm(agent, '80')).toBe(false);
    expect(matchesTerm(agent, 'zonkwa')).toBe(false);
  });

  it('pages a list and keeps the page within range', () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(pageOf(items, 2, 15)).toMatchObject({
      data: [15, 16, 17, 18, 19],
      current_page: 2,
      last_page: 2,
      from: 16,
      to: 20,
    });
    expect(pageOf(items, 9, 15).current_page).toBe(2);
    expect(pageOf([], 1, 15)).toMatchObject({ last_page: 1, from: null, to: null });
  });
});
