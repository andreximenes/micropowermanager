import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { AppShell } from './AppShell';

import { readSession } from '@/auth/session';
import { SPARK_SHS_PLUGIN_ID } from '@/legacy';
import { signIn } from '@/test/fixtures';
import { server } from '@/test/server';
import { renderWithProviders } from '@/test/render';

describe('AppShell', () => {
  it('shows the signed-in user, the page content and the navigation it may use', async () => {
    signIn({ permissions: ['customers', 'tickets'] });
    renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );

    expect(await screen.findByText('Page content')).toBeInTheDocument();
    expect(screen.getByText('Grace Admin')).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Customers',
      'Tickets',
      'Solar Home Systems',
      'Agents',
      'Locations',
    ]);
    expect(await nav.findByText('Spark')).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/customers');
    expect(nav.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/legacy/#/tickets');
  });

  it('lists a plugin screen only while the company has that plugin switched on', async () => {
    server.use(
      http.get('/api/plugins', () =>
        HttpResponse.json({
          data: [
            { mpm_plugin_id: SPARK_SHS_PLUGIN_ID, status: 1 },
            { mpm_plugin_id: 99, status: 0 },
          ],
        }),
      ),
    );
    signIn({ permissions: ['plugins'] });
    renderWithProviders(<AppShell>content</AppShell>);

    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(await nav.findByRole('link', { name: 'Spark SHS' })).toHaveAttribute(
      'href',
      '/legacy/#/spark-shs/overview',
    );
  });

  it('hides plugin screens from users without the plugins permission', async () => {
    signIn({ permissions: [] });
    renderWithProviders(<AppShell>content</AppShell>);

    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(await nav.findByText('Spark')).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'Spark SHS' })).not.toBeInTheDocument();
  });

  it('opens and closes the menu on small screens', async () => {
    signIn();
    const { user } = renderWithProviders(<AppShell>content</AppShell>);

    const open = await screen.findByRole('button', { name: 'Open menu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('hidden');

    await user.click(open);

    const close = screen.getByRole('button', { name: 'Close menu' });
    expect(close).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Main' })).not.toHaveClass('hidden');

    await user.click(close);

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('logs out to the login page and clears the shared session', async () => {
    signIn();
    const { user, router } = renderWithProviders(<AppShell>content</AppShell>);

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(readSession()).toBeNull();
  });
});
