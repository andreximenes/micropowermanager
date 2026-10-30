import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { ageOf, daysUntil, dotClassOf, dueStateOf } from './labels';

import { pickOption } from '@/test/combobox';
import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import { ticketListHandlers } from '@/test/ticketFixtures';

const panel = () => screen.getByRole('dialog');

describe('TicketSettings', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists categories and the CRM users tickets can be assigned to', async () => {
    ticketListHandlers();
    renderApp('/tickets/settings');

    const categories = await screen.findByRole('list', { name: 'Categories' });
    const items = within(categories).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Device faultIn house');
    expect(items[1]).toHaveTextContent('InstallationOutsourced');

    const staff = await screen.findByRole('list', { name: 'Support staff' });
    expect(within(staff).getByText('Grace Admin')).toBeInTheDocument();
    expect(within(staff).getByText('CRM user · grace@example.com')).toBeInTheDocument();
    expect(within(staff).getByText('CRM user · cannot be assigned yet')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Tickets',
      }),
    ).toHaveAttribute('href', '/tickets');
  });

  it('says when there are no categories, or when they cannot load', async () => {
    ticketListHandlers({ categories: [] });
    server.use(
      http.get('/api/tickets/users', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    renderApp('/tickets/settings');

    expect(
      await screen.findByText('No categories yet. Tickets need one, so add the first.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load support staff: Forbidden',
    );
  });

  it('adds an outsourced category with a color', async () => {
    ticketListHandlers();
    const created: unknown[] = [];
    server.use(
      http.post('/api/tickets/labels', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: { id: 9 } }, { status: 201 });
      }),
    );
    const { user } = renderApp('/tickets/settings');

    await user.click(await screen.findByRole('button', { name: '+ New category' }));
    await user.click(within(panel()).getByRole('button', { name: 'Save category' }));
    expect(await within(panel()).findByText('Enter at least 2 characters.')).toBeInTheDocument();

    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Panel cleaning');
    await user.click(within(panel()).getByRole('radio', { name: 'Purple' }));
    await user.click(within(panel()).getByRole('checkbox'));
    await user.click(within(panel()).getByRole('button', { name: 'Save category' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(created).toEqual([
      { labelName: 'Panel cleaning', labelColor: 'purple', outSourcing: true },
    ]);
  });

  it('keeps the category sheet open with the reason when saving fails', async () => {
    ticketListHandlers();
    server.use(
      http.post('/api/tickets/labels', () =>
        HttpResponse.json(
          { message: 'The label name field is required.', errors: { labelName: ['Required.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/tickets/settings');

    await user.click(await screen.findByRole('button', { name: '+ New category' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Panel');
    await user.click(within(panel()).getByRole('button', { name: 'Save category' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The category was not saved: The label name field is required.',
    );
    expect(within(panel()).getByText('Required.')).toBeInTheDocument();
  });

  it('adds an external person with their phone number in international form', async () => {
    ticketListHandlers();
    const created: unknown[] = [];
    server.use(
      http.post('/api/tickets/users/external', async ({ request }) => {
        created.push(await request.json());
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { user } = renderApp('/tickets/settings');

    await user.click(await screen.findByRole('button', { name: '+ External person' }));
    await user.click(within(panel()).getByRole('button', { name: 'Add person' }));
    expect(await within(panel()).findByText('Enter the phone number.')).toBeInTheDocument();

    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Bello Electricals');
    await pickOption(
      user,
      within(panel()).getByRole('combobox', { name: 'Country code' }),
      'Nigeria',
      'NG +234',
    );
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Phone number' }),
      '0812 554 9031',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Add person' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Bello Electricals was added. External people don't appear in this list.",
    );
    expect(created).toEqual([{ username: 'Bello Electricals', phone: '+2348125549031' }]);
  });

  it('shows why an external person was not added', async () => {
    ticketListHandlers();
    server.use(
      http.post('/api/tickets/users/external', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/tickets/settings');

    await user.click(await screen.findByRole('button', { name: '+ External person' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Name *' }), 'Bello');
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Phone number' }),
      '+2348125549031',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Add person' }));

    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'The person was not added: Server error',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ticket labels', () => {
  const now = new Date('2026-10-29T10:00:00Z');

  it('counts days to a due date and marks open tickets past it as late', () => {
    expect(daysUntil('2026-10-26', now)).toBe(-3);
    expect(dueStateOf({ due_date: '2026-10-26', status: 0 }, now)).toEqual({
      text: 'Due 26 Oct 2026 · late',
      late: true,
    });
    expect(dueStateOf({ due_date: '2026-10-26', status: 1 }, now).late).toBe(false);
    expect(dueStateOf({ due_date: null, status: 0 }, now)).toEqual({
      text: 'No due date',
      late: false,
    });
  });

  it('describes how long a ticket has been open', () => {
    expect(ageOf(null, now)).toBe('—');
    expect(ageOf('2026-10-29T09:00:00Z', now)).toBe('1 hour');
    expect(ageOf('2026-10-29T12:00:00Z', now)).toBe('0 hours');
    expect(ageOf('2026-10-28T09:00:00Z', now)).toBe('1 day');
  });

  it('falls back to a neutral dot for colors it does not know', () => {
    expect(dotClassOf('red')).toBe('bg-red');
    expect(dotClassOf('CornflowerBlue')).toBe(dotClassOf('nocolor'));
    expect(dotClassOf(null)).toBe(dotClassOf('nocolor'));
  });
});
