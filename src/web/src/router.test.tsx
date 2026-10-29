import { screen } from '@testing-library/react';

import { customerHandlers, signIn } from '@/test/fixtures';
import { stubLocationNavigation } from '@/test/location';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

describe('router', () => {
  it('sends a signed-out visitor to the login page and remembers where they were going', async () => {
    const { router } = renderApp('/customers/7?tab=payments');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/customers/7?tab=payments' });
  });

  it('opens the customer profile for a signed-in user', async () => {
    signIn();
    server.use(...customerHandlers());
    renderApp('/customers/7');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amina Okafor' }),
    ).toBeInTheDocument();
  });

  it('hands the home page over to the legacy customer list', async () => {
    signIn();
    const { replace } = stubLocationNavigation();
    renderApp('/');

    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/legacy/#/people'));
  });

  it('does not open a profile for an id that is not a positive integer', async () => {
    signIn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderApp('/customers/abc');

    expect(await screen.findByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
