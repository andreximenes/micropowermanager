import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { readSession } from '@/auth/session';
import { loginResponse } from '@/test/fixtures';
import { stubLocationNavigation } from '@/test/location';
import { renderApp } from '@/test/render';
import { createGate } from '@/test/gate';
import { server } from '@/test/server';

/** Accepts the login once `gate` resolves, right away by default. */
function acceptLogin(gate: Promise<unknown> = Promise.resolve()) {
  server.use(
    http.post('/api/auth/login', async () => {
      await gate;
      return HttpResponse.json(loginResponse());
    }),
    http.get('/api/settings/main', () =>
      HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS' } }),
    ),
    http.get('/api/map-settings', () => HttpResponse.json({ data: [] })),
  );
}

async function signInWith(user: UserEvent, password = 'secret') {
  await user.type(await screen.findByLabelText('E-mail'), 'grace@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('signs in and opens the redirect target', async () => {
    const gate = createGate();
    acceptLogin(gate.promise);
    const { assign } = stubLocationNavigation();
    const { user } = renderApp('/login?redirect=%2Fcustomers%2F7');

    await signInWith(user);

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
    gate.open();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/customers/7'));
    expect(readSession()?.user.name).toBe('Grace Admin');
  });

  it('goes home, which hands over to the legacy customer list, without a redirect', async () => {
    acceptLogin();
    const { assign, replace } = stubLocationNavigation();
    const { user } = renderApp('/login');

    await signInWith(user);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/legacy/#/people'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('ignores a redirect to another site', async () => {
    acceptLogin();
    const { assign, replace } = stubLocationNavigation();
    const { user } = renderApp('/login?redirect=%2F%2Fevil.example%2Fphish');

    await signInWith(user);

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/legacy/#/people'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('explains wrong credentials', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );
    const { user } = renderApp('/login');

    await signInWith(user, 'wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong e-mail or password.');
    expect(readSession()).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows other failures as they come', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Too many attempts.' }, { status: 429 }),
      ),
    );
    const { user } = renderApp('/login');

    await signInWith(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.');
  });

  it('links to the legacy password reset', async () => {
    renderApp('/login');

    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/legacy/#/forgot-password',
    );
  });
});
