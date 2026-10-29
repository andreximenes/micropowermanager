import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { canDeleteUser, canEditUser, personOf, roleLabel, roleSummary } from './roles';

import { fetchAllUsers, type ListedUser } from '@/api/users';
import { readSession } from '@/auth/session';
import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const OWNER_RIGHTS = ['users', 'users.manage-admin', 'users.manage-owner', 'roles', 'settings'];

function userFixture(overrides: Partial<ListedUser> = {}): ListedUser {
  return {
    id: 2,
    name: 'Grace Adeyemi',
    email: 'grace@spark.ng',
    roles: ['admin'],
    address_details: null,
    ...overrides,
  };
}

function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index];
  if (!element) {
    throw new Error(`No element at ${index}`);
  }
  return element;
}

const users = [
  userFixture({ id: 1, name: 'Grace Admin', email: 'grace@example.com', roles: ['owner'] }),
  userFixture({ id: 2, name: 'Neema Mushi', email: 'neema@spark.ng', roles: ['admin'] }),
  userFixture({ id: 3, name: 'Tunde', email: 'tunde@spark.ng', roles: ['user', 'field-ops'] }),
  // The list sends `[]` for a user without an address.
  {
    ...userFixture({ id: 4, name: 'Nobody', email: 'nobody@spark.ng', roles: [] }),
    address_details: [],
  },
];

const roles = [
  { name: 'owner', guard_name: 'api', permissions: ['users', 'users.manage-owner'] },
  { name: 'admin', guard_name: 'api', permissions: ['users', 'users.manage-admin'] },
  { name: 'user', guard_name: 'api', permissions: ['customers', 'appliances', 'tickets'] },
];

function usersPage(data: unknown[], currentPage = 1, lastPage = 1) {
  return { data, links: {}, meta: { current_page: currentPage, last_page: lastPage, total: 4 } };
}

function userHandlers(list: unknown[] = users) {
  server.use(
    http.get('/api/users', () => HttpResponse.json(usersPage(list))),
    http.get('/api/roles/details', () => HttpResponse.json(roles)),
  );
}

const panel = () => screen.getByRole('dialog');

describe('UserList', () => {
  beforeEach(() => {
    signIn({ permissions: OWNER_RIGHTS });
  });

  it('lists users with their roles and the actions the account may take', async () => {
    userHandlers();
    renderApp('/settings/users');

    const table = await screen.findByRole('table', { name: 'Users' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('GAGrace Admin(you)grace@example.comOwner');
    // The only owner and yourself cannot be deleted; the only owner cannot be edited either.
    expect(within(nth(rows, 1)).queryByRole('button')).not.toBeInTheDocument();
    expect(within(nth(rows, 2)).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(
      within(nth(rows, 2)).getByRole('button', { name: 'Delete Neema Mushi' }),
    ).toBeInTheDocument();
    expect(rows[3]).toHaveTextContent('TTunde');
    expect(rows[3]).toHaveTextContent('UserField ops');
    expect(rows[4]).toHaveTextContent('No role');
    expect(screen.getByText('1–4 of 4 users')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Users' })).toBeInTheDocument();
  });

  it('searches by name or e-mail through the URL', async () => {
    userHandlers();
    const { user, router } = renderApp('/settings/users?term=neema');

    const table = await screen.findByRole('table', { name: 'Users' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);

    const search = screen.getByRole('searchbox', { name: 'Search users' });
    await user.clear(search);
    await user.type(search, 'nobody here');
    expect(await screen.findByText('No users match this search.')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ term: 'nobody here' });

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Users' })).getAllByRole('row')).toHaveLength(
        5,
      ),
    );
  });

  it('creates a user with a generated password and the chosen roles', async () => {
    userHandlers();
    const created: unknown[] = [];
    server.use(
      http.post('/api/users', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ data: { id: 9 } }, { status: 201 });
      }),
    );
    const { user } = renderApp('/settings/users');

    await user.click(await screen.findByRole('button', { name: '+ New user' }));
    const password = within(panel()).getByRole('textbox', { name: 'Password *' });
    const generated = (password as HTMLInputElement).value;
    expect(generated).toMatch(/^[a-zA-Z0-9]{12}$/);
    await user.click(within(panel()).getByRole('button', { name: 'Generate another' }));
    expect(password).not.toHaveValue(generated);

    await user.click(within(panel()).getByRole('button', { name: 'Create user' }));
    expect(await within(panel()).findByText('Enter at least 3 characters.')).toBeInTheDocument();
    expect(within(panel()).getByText('Enter a valid e-mail address.')).toBeInTheDocument();
    expect(within(panel()).getByText('Choose at least one role.')).toBeInTheDocument();

    expect(
      within(panel()).getByText('Everything, including managing other owners.'),
    ).toBeInTheDocument();
    expect(within(panel()).getByText('Customers, products and tickets.')).toBeInTheDocument();
    await user.type(
      within(panel()).getByRole('textbox', { name: 'Full name *' }),
      'Zainab Suleiman',
    );
    await user.type(within(panel()).getByRole('textbox', { name: 'E-mail *' }), 'zainab@spark.ng');
    await user.clear(password);
    await user.type(password, 'secret12');
    await user.click(within(panel()).getByRole('checkbox', { name: /Admin/ }));
    await user.click(within(panel()).getByRole('checkbox', { name: /User/ }));
    await user.click(within(panel()).getByRole('checkbox', { name: /Admin/ }));
    await user.click(within(panel()).getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(created).toEqual([
      { name: 'Zainab Suleiman', email: 'zainab@spark.ng', password: 'secret12', roles: ['user'] },
    ]);
  });

  it('creates a user without a role choice when the account cannot list roles', async () => {
    signIn({ permissions: ['users'] });
    userHandlers();
    const created: unknown[] = [];
    server.use(
      http.post('/api/users', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json(
          { message: 'Taken.', errors: { email: ['The email is taken.'] } },
          { status: 422 },
        );
      }),
    );
    const { user } = renderApp('/settings/users');

    await user.click(await screen.findByRole('button', { name: '+ New user' }));
    expect(within(panel()).queryByRole('group', { name: 'Roles' })).not.toBeInTheDocument();
    await user.type(within(panel()).getByRole('textbox', { name: 'Full name *' }), 'Zainab');
    await user.type(within(panel()).getByRole('textbox', { name: 'E-mail *' }), 'z@spark.ng');
    await user.click(within(panel()).getByRole('button', { name: 'Create user' }));

    expect(await within(panel()).findByText('The email is taken.')).toBeInTheDocument();
    expect(within(panel()).getByRole('alert')).toHaveTextContent('The user was not saved: Taken.');
    expect(created).toEqual([expect.objectContaining({ roles: [] })]);
  });

  it('edits a name and roles, offering only roles the account may give', async () => {
    signIn({ permissions: ['users', 'users.manage-admin', 'roles'] });
    userHandlers();
    const updates: unknown[] = [];
    server.use(
      http.put('/api/users/3', async ({ request }) => {
        updates.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/settings/users');

    const table = await screen.findByRole('table', { name: 'Users' });
    // Without manage-owner the owner row has no actions at all.
    expect(within(nth(within(table).getAllByRole('row'), 1)).queryByRole('button')).toBeNull();
    await user.click(
      within(nth(within(table).getAllByRole('row'), 3)).getByRole('button', { name: 'Edit' }),
    );

    expect(within(panel()).getByRole('heading', { name: 'Edit Tunde' })).toBeInTheDocument();
    expect(within(panel()).getByRole('checkbox', { name: /Owner/ })).toBeDisabled();
    expect(
      within(panel()).getByText('Only an owner or admin with that right can give this role.'),
    ).toBeInTheDocument();
    expect(within(panel()).getByRole('checkbox', { name: /User/ })).toBeChecked();
    await user.click(within(panel()).getByRole('checkbox', { name: /User/ }));
    await user.click(within(panel()).getByRole('checkbox', { name: /Admin/ }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Full name *' }), ' Bakare');
    await user.click(within(panel()).getByRole('button', { name: 'Save user' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updates).toEqual([{ id: 3, name: 'Tunde Bakare', roles: ['field-ops', 'admin'] }]);
  });

  it('edits only the name when the account cannot list roles', async () => {
    signIn({ permissions: ['users'] });
    userHandlers();
    const updates: unknown[] = [];
    server.use(
      http.put('/api/users/4', async ({ request }) => {
        updates.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/settings/users');

    const table = await screen.findByRole('table', { name: 'Users' });
    await user.click(
      within(nth(within(table).getAllByRole('row'), 4)).getByRole('button', { name: 'Edit' }),
    );
    await user.click(within(panel()).getByRole('button', { name: 'Save user' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updates).toEqual([{ id: 4, name: 'Nobody' }]);
  });

  it('deletes a user after confirming', async () => {
    let list: { id: number }[] = users;
    userHandlers();
    server.use(
      http.get('/api/users', () => HttpResponse.json(usersPage(list))),
      http.delete('/api/users/2', () => {
        list = list.filter((candidate) => candidate.id !== 2);
        return HttpResponse.json({ data: { message: 'User deleted' } });
      }),
    );
    const { user } = renderApp('/settings/users');

    const table = await screen.findByRole('table', { name: 'Users' });
    await user.click(within(table).getByRole('button', { name: 'Delete Neema Mushi' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('neema@spark.ng can no longer sign in to Spark CRM.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete user' }));

    await waitFor(() => expect(screen.queryByText('Neema Mushi')).not.toBeInTheDocument());
  });

  it('tells people without the users right, and reports a failed load', async () => {
    signIn({ permissions: ['customers'] });
    renderApp('/settings/users');

    expect(await screen.findByText(/Your account cannot manage users/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ New user' })).not.toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json({ message: 'No' }, { status: 500 })));
    renderApp('/settings/users');

    expect(await screen.findByText('Could not load users: No')).toBeInTheDocument();
  });
});

describe('users API and role helpers', () => {
  it('gathers every page of users', async () => {
    signIn();
    server.use(
      http.get('/api/users', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(
          usersPage([userFixture({ id: page, address_details: null })], page, 3),
        );
      }),
    );

    expect((await fetchAllUsers()).map((user) => user.id)).toEqual([1, 2, 3]);
  });

  it('names roles and summarises what they allow', () => {
    expect(roleLabel('financial-manager')).toBe('Financial manager');
    expect(roleLabel('field_ops')).toBe('Field ops');
    expect(roleSummary({ name: 'x', permissions: [] })).toBe('No access to any area yet.');
    expect(roleSummary({ name: 'x', permissions: ['reports'] })).toBe('Reports.');
    expect(roleSummary({ name: 'x', permissions: ['users.manage-admin'] })).toBe(
      'Everything except managing owners.',
    );
    expect(personOf('  Grace  ')).toEqual({ name: 'Grace', surname: '' });
    expect(personOf('Grace Ada Adeyemi')).toEqual({ name: 'Grace', surname: 'Adeyemi' });
  });

  it('lets an owner edit another owner and anyone edit themselves', () => {
    const session = signIn({ permissions: ['users.manage-owner'] });
    const owner = userFixture({ id: 5, roles: ['owner'] });
    expect(canEditUser(session, owner, 2)).toBe(true);
    expect(canEditUser(readSession(), userFixture({ id: 1, roles: ['user'] }), 2)).toBe(true);
    expect(canEditUser(null, userFixture({ id: 1, roles: ['user'] }), 2)).toBe(false);
    expect(canDeleteUser(session, owner)).toBe(true);
    expect(canDeleteUser(session, userFixture({ id: 6, roles: ['admin'] }))).toBe(false);
  });
});
