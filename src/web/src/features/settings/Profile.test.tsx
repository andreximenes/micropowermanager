import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { paginator, signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const profile = {
  id: 1,
  name: 'Grace Admin',
  email: 'grace@example.com',
  address_details: {
    phone: '+2348032004417',
    street: '4 Ahmadu Bello Way',
    city: { id: 2, name: 'Kafanchan' },
  },
};

function profileHandlers(user: unknown = profile) {
  server.use(
    http.get('/api/users/1', () => HttpResponse.json({ data: user })),
    http.get('/api/cities', () =>
      HttpResponse.json(paginator([{ id: 5, name: 'Kagoro', mini_grid_id: 1 }])),
    ),
  );
}

const details = () => screen.getByRole('form', { name: 'Details' });
const password = () => screen.getByRole('form', { name: 'Change password' });

describe('Profile', () => {
  beforeEach(() => {
    signIn({ roles: ['owner', 'financial-manager'] });
  });

  it('shows who is signed in and saves the name and address', async () => {
    profileHandlers();
    const sent: [string, unknown][] = [];
    server.use(
      http.put('/api/users/1', async ({ request }) => {
        sent.push(['user', await request.json()]);
        return HttpResponse.json({ data: {} });
      }),
      http.put('/api/users/1/addresses', async ({ request }) => {
        sent.push(['address', await request.json()]);
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    expect(
      await screen.findByText('grace@example.com · Owner · Financial manager'),
    ).toBeInTheDocument();
    const name = await within(details()).findByRole('textbox', { name: 'Full name *' });
    expect(name).toHaveValue('Grace Admin');
    expect(within(details()).getByRole('combobox', { name: 'Country code' })).toHaveValue('NG');
    expect(within(details()).getByRole('textbox', { name: 'Phone number' })).toHaveValue(
      '8032004417',
    );

    await user.clear(name);
    await user.type(name, 'Grace Adeyemi');
    await user.click(within(details()).getByRole('button', { name: 'Save details' }));

    expect(await within(details()).findByRole('status')).toHaveTextContent('Details saved.');
    expect(sent).toEqual([
      ['user', { id: 1, name: 'Grace Adeyemi' }],
      [
        'address',
        {
          id: 1,
          name: 'Grace Adeyemi',
          phone: '+2348032004417',
          street: '4 Ahmadu Bello Way',
          city_id: 2,
        },
      ],
    ]);
  });

  it('saves only the name when there is no address, and asks for both parts of one', async () => {
    profileHandlers({ ...profile, address_details: null });
    const sent: string[] = [];
    server.use(
      http.put('/api/users/1', () => {
        sent.push('user');
        return HttpResponse.json({ data: {} });
      }),
      http.put('/api/users/1/addresses', () => {
        sent.push('address');
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    const street = await within(details()).findByRole('textbox', { name: 'Street or landmark' });
    await user.type(street, 'Market road');
    await user.click(within(details()).getByRole('button', { name: 'Save details' }));
    expect(
      await within(details()).findByText('Choose your village to save a phone or address.'),
    ).toBeInTheDocument();
    expect(
      within(details()).getByText('Enter your phone number to save an address.'),
    ).toBeInTheDocument();

    await user.clear(street);
    await user.click(within(details()).getByRole('button', { name: 'Save details' }));
    await waitFor(() => expect(sent).toEqual(['user']));
  });

  it('explains a refusal in plain words', async () => {
    profileHandlers();
    server.use(
      http.put('/api/users/1', () =>
        HttpResponse.json({ message: 'This action is unauthorized.' }, { status: 403 }),
      ),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    await user.click(await within(details()).findByRole('button', { name: 'Save details' }));

    expect(await within(details()).findByRole('alert')).toHaveTextContent(
      'Your details were not saved: your account is not allowed to change them.',
    );
  });

  it('puts the server field messages next to the fields', async () => {
    profileHandlers();
    server.use(
      http.put('/api/users/1', () => HttpResponse.json({ data: {} })),
      http.put('/api/users/1/addresses', () =>
        HttpResponse.json(
          { message: 'Invalid phone.', errors: { phone: ['Invalid phone.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    await user.click(await within(details()).findByRole('button', { name: 'Save details' }));

    expect(await within(details()).findByRole('alert')).toHaveTextContent(
      'Your details were not saved: Invalid phone.',
    );
  });

  it('changes the password after checking both entries', async () => {
    profileHandlers();
    const sent: unknown[] = [];
    server.use(
      http.put('/api/users/password/1', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    const newPassword = await within(password()).findByLabelText('New password *');
    await user.type(newPassword, 'abc');
    await user.type(within(password()).getByLabelText('Repeat new password *'), 'abd');
    await user.click(within(password()).getByRole('button', { name: 'Change password' }));
    expect(await within(password()).findByText('Use at least 5 characters.')).toBeInTheDocument();
    expect(within(password()).getByText('The two passwords differ.')).toBeInTheDocument();

    await user.clear(newPassword);
    await user.type(newPassword, 'sunrise-42');
    await user.clear(within(password()).getByLabelText('Repeat new password *'));
    await user.type(within(password()).getByLabelText('Repeat new password *'), 'sunrise-42');
    await user.click(within(password()).getByRole('button', { name: 'Change password' }));

    expect(await within(password()).findByRole('status')).toHaveTextContent('Password changed.');
    expect(sent).toEqual([{ id: 1, password: 'sunrise-42', confirm_password: 'sunrise-42' }]);
    expect(newPassword).toHaveValue('');
  });

  it('says when the account may not change passwords', async () => {
    profileHandlers();
    server.use(
      http.put('/api/users/password/1', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    );
    const { user } = renderApp('/profile');
    await screen.findByRole('form', { name: 'Details' });

    await user.type(await within(password()).findByLabelText('New password *'), 'sunrise-42');
    await user.type(within(password()).getByLabelText('Repeat new password *'), 'sunrise-42');
    await user.click(within(password()).getByRole('button', { name: 'Change password' }));

    expect(await within(password()).findByRole('alert')).toHaveTextContent(
      'changing passwords needs the user management right',
    );
  });

  it('reports a profile that cannot load', async () => {
    server.use(
      http.get('/api/users/1', () => HttpResponse.json({ message: 'Gone' }, { status: 500 })),
    );
    renderApp('/profile');

    expect(await screen.findByText('Could not load your profile: Gone')).toBeInTheDocument();
  });
});
