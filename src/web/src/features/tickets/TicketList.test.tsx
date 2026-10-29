import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { customerHandlers, paginator, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import {
  listedTicketFixture,
  ticketCategoryFixture,
  ticketListHandlers,
} from '@/test/ticketFixtures';

const table = async () => screen.findByRole('table', { name: 'Tickets' });
const panel = () => screen.getByRole('dialog');

describe('TicketList', () => {
  beforeEach(() => {
    signIn();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('lists open tickets with customer, category, assignee, due date and age', async () => {
    ticketListHandlers({
      open: [
        listedTicketFixture(),
        listedTicketFixture({
          id: 2299,
          title: 'Wants to change payment day',
          due_date: null,
          assigned_to: null,
          category: null,
          owner: null,
          created_at: '2026-10-29T07:00:00.000000Z',
        }),
        listedTicketFixture({
          id: 2289,
          title: 'Install second lamp',
          due_date: '2026-11-04',
          assigned_to: { id: 30, user_name: 'Bello Electricals', out_source: true },
          created_at: '2026-10-28T09:00:00.000000Z',
        }),
      ],
    });
    renderApp('/tickets');

    const rows = within(await table()).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Kit not charging after rain');
    expect(rows[1]).toHaveTextContent('Chinedu Okafor · #2291');
    expect(rows[1]).toHaveTextContent('Device fault');
    expect(rows[1]).toHaveTextContent('Musa Ibrahim');
    expect(rows[1]).toHaveTextContent('Due 26 Oct 2026 · late');
    expect(rows[1]).toHaveTextContent('5 days');
    expect(rows[2]).toHaveTextContent('No customer · #2299');
    expect(rows[2]).toHaveTextContent('No category');
    expect(rows[2]).toHaveTextContent('Unassigned');
    expect(rows[2]).toHaveTextContent('No due date');
    expect(rows[2]).toHaveTextContent('3 hours');
    expect(rows[3]).toHaveTextContent('Bello Electricals');
    expect(rows[3]).toHaveTextContent('external');
    expect(rows[3]).toHaveTextContent('1 day');
    expect(screen.getByRole('list', { name: 'Tickets' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^Open\s*3$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches to closed tickets and pages through them', async () => {
    const requests = ticketListHandlers({
      closed: [listedTicketFixture({ id: 5, title: 'Fixed fuse', status: 1 })],
    });
    const { user, router } = renderApp('/tickets');
    await table();

    await user.click(await screen.findByRole('tab', { name: /^Closed\s*1$/ }));

    expect(await within(await table()).findByText('Fixed fuse')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ status: 'closed' });
    expect(requests.at(-1)?.get('status')).toBe('1');
    expect(requests.at(-1)?.get('limit')).toBe('15');
  });

  it('filters by category and by assignee, including the signed-in user', async () => {
    const requests = ticketListHandlers();
    const { user } = renderApp('/tickets');
    await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Installation');
    await waitFor(() => expect(requests.at(-1)?.get('category')).toBe('4'));

    await screen.findByRole('option', { name: 'Assigned to me' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Assigned to' }),
      'Assigned to me',
    );
    await waitFor(() => expect(requests.at(-1)?.get('person')).toBe('10'));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Assigned to' }), 'Musa Ibrahim');
    await waitFor(() => expect(requests.at(-1)?.get('person')).toBe('11'));

    expect(
      within(screen.getByRole('combobox', { name: 'Assigned to' })).queryByRole('option', {
        name: 'New Hire',
      }),
    ).not.toBeInTheDocument();
  });

  it('offers to clear filters when nothing matches', async () => {
    ticketListHandlers({ open: [] });
    const { user, router } = renderApp('/tickets?category=4');

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toEqual({});
    expect(await screen.findByText('No open tickets. All done.')).toBeInTheDocument();
  });

  it('says when the list cannot load', async () => {
    ticketListHandlers();
    server.use(
      http.get('/api/tickets/ticket', () =>
        HttpResponse.json({ message: 'Server down' }, { status: 500 }),
      ),
    );
    renderApp('/tickets');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load tickets: Server down',
    );
  });

  it('opens a ticket with its comments, posts a comment and closes it', async () => {
    const ticket = listedTicketFixture({
      comments: [
        {
          id: 1,
          comment: 'Visited. Cable is cut.',
          created_at: '2026-10-25T10:12:00.000000Z',
          ticket_user: { id: 11, user_name: 'Musa Ibrahim' },
        },
        { id: 2, comment: 'Who wrote this?', created_at: null, ticket_user: null },
      ],
    });
    ticketListHandlers({ open: [ticket] });
    const posted: unknown[] = [];
    let closed = false;
    server.use(
      http.get('/api/tickets/ticket/2291', () => HttpResponse.json({ data: ticket })),
      http.post('/api/tickets/comments', async ({ request }) => {
        posted.push(await request.json());
        return new HttpResponse(null, { status: 200 });
      }),
      http.delete('/api/tickets/ticket/2291', () => {
        closed = true;
        return HttpResponse.json({ data: { data: { ...ticket, status: 1 } } });
      }),
    );
    const { user, router } = renderApp('/tickets');

    await user.click(within(await table()).getByText('Device fault'));

    expect(router.state.location.search).toEqual({ ticket: 2291 });
    expect(await within(panel()).findByText('Open · 3 days late')).toBeInTheDocument();
    expect(within(panel()).getByText('Ticket #2291 · opened 24 Oct 2026')).toBeInTheDocument();
    expect(within(panel()).getByRole('link', { name: 'Chinedu Okafor' })).toHaveAttribute(
      'href',
      '/customers/7',
    );
    expect(
      within(panel()).getByText('Battery light stays red since the storm.'),
    ).toBeInTheDocument();
    expect(within(panel()).getByText('Comments · 2')).toBeInTheDocument();
    expect(within(panel()).getByText('Visited. Cable is cut.')).toBeInTheDocument();
    expect(within(panel()).getByText('Unknown')).toBeInTheDocument();

    await user.type(within(panel()).getByLabelText('Add a comment'), 'Cable ordered.');
    await user.click(within(panel()).getByRole('button', { name: 'Post comment' }));
    await waitFor(() => expect(posted).toEqual([{ cardId: 2291, comment: 'Cable ordered.' }]));
    await waitFor(() => expect(within(panel()).getByLabelText('Add a comment')).toHaveValue(''));

    await user.click(within(panel()).getByRole('button', { name: 'Close ticket' }));
    const confirm = await screen.findByRole('dialog', { name: 'Close this ticket?' });
    await user.click(within(confirm).getByRole('button', { name: 'Close ticket' }));
    await waitFor(() => expect(closed).toBe(true));
  });

  it('keeps the panel open with the reason when a comment fails', async () => {
    const ticket = listedTicketFixture();
    ticketListHandlers({ open: [ticket] });
    server.use(
      http.get('/api/tickets/ticket/2291', () => HttpResponse.json({ data: ticket })),
      http.post('/api/tickets/comments', () =>
        HttpResponse.json({ message: 'Ticket not found' }, { status: 404 }),
      ),
    );
    const { user } = renderApp('/tickets?ticket=2291');

    await user.type(
      await within(await screen.findByRole('dialog')).findByLabelText('Add a comment'),
      'Hi',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Post comment' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The comment was not posted: Ticket not found',
    );
  });

  it('shows a closed ticket read-only, without customer links for users who cannot open customers', async () => {
    signIn({ permissions: ['tickets'] });
    const ticket = listedTicketFixture({ status: 1, assigned_to: null, content: null });
    ticketListHandlers({ closed: [ticket] });
    server.use(http.get('/api/tickets/ticket/2291', () => HttpResponse.json({ data: ticket })));
    const { user } = renderApp('/tickets?status=closed&ticket=2291');

    expect(
      await within(await screen.findByRole('dialog')).findByText('Closed'),
    ).toBeInTheDocument();
    expect(within(panel()).getByText('Chinedu Okafor')).toBeInTheDocument();
    expect(within(panel()).queryByRole('link', { name: 'Chinedu Okafor' })).not.toBeInTheDocument();
    expect(within(panel()).getByText('No description.')).toBeInTheDocument();
    expect(within(panel()).getByText('No comments yet.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Close ticket' })).not.toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says when a ticket cannot load', async () => {
    ticketListHandlers();
    server.use(
      http.get('/api/tickets/ticket/9', () =>
        HttpResponse.json({ message: 'Gone' }, { status: 404 }),
      ),
    );
    renderApp('/tickets?ticket=9');

    expect(
      await within(await screen.findByRole('dialog')).findByText(
        'Could not load this ticket: Gone',
      ),
    ).toBeInTheDocument();
  });

  it('opens a ticket for a customer found by search, asking what an outsourced category pays', async () => {
    ticketListHandlers();
    const created: unknown[] = [];
    server.use(
      http.get('/api/people', () =>
        HttpResponse.json(
          paginator([
            {
              id: 7,
              name: 'Chinedu',
              surname: 'Okafor',
              is_active: true,
              addresses: [{ phone: '+2348062217730', city: { id: 2, name: 'Kafanchan' } }],
              devices: [],
              latest_payment: null,
              contracts_count: 0,
              outstanding_amount: 0,
              overdue_since: null,
            },
          ]),
        ),
      ),
      http.post('/api/tickets/ticket', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: { id: 3001 } }, { status: 201 });
      }),
      http.get('/api/tickets/ticket/3001', () =>
        HttpResponse.json({ data: listedTicketFixture({ id: 3001, title: 'Install lamp' }) }),
      ),
    );
    const { user, router } = renderApp('/tickets');
    await table();

    await user.click(screen.getByRole('button', { name: '+ New ticket' }));
    await user.click(within(panel()).getByRole('button', { name: 'Open ticket' }));
    expect(await within(panel()).findByText('Choose the customer.')).toBeInTheDocument();
    expect(within(panel()).getByText('Describe the issue.')).toBeInTheDocument();

    await user.type(within(panel()).getByRole('combobox', { name: 'Customer *' }), 'Chin');
    await user.click(await within(panel()).findByRole('option', { name: /Chinedu Okafor/ }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Title *' }), 'Install lamp');
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'Category *' }),
      'Installation (outsourced)',
    );
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'Assigned to' }),
      'Musa Ibrahim',
    );
    await user.type(within(panel()).getByLabelText('Due date'), '2026-11-04');
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Description *' }),
      'Kitchen lamp.',
    );
    await user.type(within(panel()).getByRole('textbox', { name: /Pay for this ticket/ }), '35.5');
    await user.click(within(panel()).getByRole('button', { name: 'Open ticket' }));
    expect(
      await within(panel()).findByText('Enter a whole amount, e.g. 3500.'),
    ).toBeInTheDocument();

    await user.clear(within(panel()).getByRole('textbox', { name: /Pay for this ticket/ }));
    await user.type(within(panel()).getByRole('textbox', { name: /Pay for this ticket/ }), '3500');
    await user.click(within(panel()).getByRole('button', { name: 'Open ticket' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ ticket: 3001 }));
    expect(created).toEqual([
      {
        title: 'Install lamp',
        description: 'Kitchen lamp.',
        label: 4,
        owner_id: 7,
        assignedPerson: 11,
        dueDate: '2026-11-04',
        outsourcing: 3500,
      },
    ]);
  });

  it('opens a ticket from the customer profile, without a pay field for in-house categories', async () => {
    ticketListHandlers({ categories: [ticketCategoryFixture()] });
    server.use(
      ...customerHandlers(),
      http.post('/api/tickets/ticket', () =>
        HttpResponse.json(
          { message: 'The title is too long.', errors: { title: ['The title is too long.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/customers/7');

    await user.click(await screen.findByRole('button', { name: 'New ticket' }));
    expect(within(panel()).getByText('For Amina Okafor')).toBeInTheDocument();
    expect(within(panel()).queryByRole('combobox', { name: 'Customer *' })).not.toBeInTheDocument();
    await user.type(within(panel()).getByRole('textbox', { name: 'Title *' }), 'Lamp flickers');
    await user.selectOptions(
      within(panel()).getByRole('combobox', { name: 'Category *' }),
      'Device fault',
    );
    expect(
      within(panel()).queryByRole('textbox', { name: /Pay for this ticket/ }),
    ).not.toBeInTheDocument();
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Description *' }),
      'Since Monday.',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Open ticket' }));

    expect(
      await within(panel()).findByText('The title is too long.', { selector: 'p.text-xs' }),
    ).toBeInTheDocument();
    expect(within(panel()).getByRole('alert')).toHaveTextContent(
      'The ticket was not opened: The title is too long.',
    );
  });
});
