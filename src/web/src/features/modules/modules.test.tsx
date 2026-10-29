import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { enabledModuleKeys } from './catalog';

import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const settings = {
  id: 1,
  site_title: 'MPM',
  company_name: 'Spark 234',
  currency: 'NGN',
  country: 'Nigeria',
  language: 'en',
  vat_energy: 7.5,
  vat_appliance: 0,
  usage_type: 'shs',
  sms_gateway_id: null,
  transaction_sms_enabled: false,
  down_payment_max_token_days: null,
};

/** Main settings that remember the modules each PUT sends, as the backend does. */
function settingsWithModules(initial: string[] | null) {
  let enabledModules = initial;
  const sent: unknown[] = [];
  server.use(
    http.get('/api/settings/main', () =>
      HttpResponse.json({ data: { ...settings, enabled_modules: enabledModules } }),
    ),
    http.put('/api/settings/main/1', async ({ request }) => {
      const body = (await request.json()) as { enabled_modules: string[] };
      sent.push(body);
      enabledModules = body.enabled_modules;
      return HttpResponse.json({ data: { ...settings, enabled_modules: enabledModules } });
    }),
  );
  return sent;
}

const mainNav = () => within(screen.getByRole('navigation', { name: 'Main' }));

describe('enabledModuleKeys', () => {
  it('keeps the known modules in menu order and drops the rest', () => {
    expect(enabledModuleKeys(['sms', 'unknown', 'mini-grids'])).toEqual(['mini-grids', 'sms']);
    expect(enabledModuleKeys(null)).toEqual([]);
    expect(enabledModuleKeys(undefined)).toEqual([]);
  });
});

describe('Settings — modules', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists every module switched off by default', async () => {
    settingsWithModules(null);
    renderApp('/settings?tab=modules');

    const list = await screen.findByRole('list', { name: 'Modules' });
    const switches = within(list).getAllByRole('switch');
    expect(switches.map((control) => control.getAttribute('aria-label'))).toEqual([
      'Mini-grids',
      'Tariffs',
      'Meters',
      'Targets',
      'SMS',
      'Maintenance',
      'E-bikes',
      'Connections',
    ]);
    expect(switches.every((control) => control.getAttribute('aria-checked') === 'false')).toBe(
      true,
    );
    expect(screen.getByText(/^0 of 8 on/)).toBeInTheDocument();
    expect(
      within(list).getByText('Connection groups and connection types used to classify meter customers.'),
    ).toBeInTheDocument();
  });

  it('switches a module on, shows it in the menu and opens its placeholder', async () => {
    const sent = settingsWithModules(['sms']);
    const { user, router } = renderApp('/settings?tab=modules');

    const meters = await screen.findByRole('switch', { name: 'Meters' });
    expect(await mainNav().findByRole('link', { name: 'SMS' })).toHaveAttribute(
      'href',
      '/modules/sms',
    );
    expect(mainNav().queryByRole('link', { name: 'Meters' })).not.toBeInTheDocument();

    await user.click(meters);

    await vi.waitFor(() => expect(meters).toHaveAttribute('aria-checked', 'true'));
    expect(sent).toEqual([{ enabled_modules: ['sms', 'meters'] }]);
    const link = await mainNav().findByRole('link', { name: 'Meters' });

    await user.click(link);

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/modules/meters'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Meters' })).toBeInTheDocument();
    expect(
      screen.getByText('The screen for Meters has not been rebuilt yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/LEGACY_SCREENS\.md/)).toBeInTheDocument();
    expect(mainNav().getByRole('link', { name: 'Meters' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches a module off again', async () => {
    const sent = settingsWithModules(['sms', 'targets']);
    const { user } = renderApp('/settings?tab=modules');

    const sms = await screen.findByRole('switch', { name: 'SMS' });
    expect(sms).toHaveAttribute('aria-checked', 'true');
    await user.click(sms);

    await vi.waitFor(() => expect(sms).toHaveAttribute('aria-checked', 'false'));
    expect(sent).toEqual([{ enabled_modules: ['targets'] }]);
    await vi.waitFor(() =>
      expect(mainNav().queryByRole('link', { name: 'SMS' })).not.toBeInTheDocument(),
    );
  });

  it('says when a module could not be switched', async () => {
    settingsWithModules(null);
    server.use(
      http.put('/api/settings/main/1', () =>
        HttpResponse.json({ message: 'The selected module is invalid.' }, { status: 422 }),
      ),
    );
    const { user } = renderApp('/settings?tab=modules');

    await user.click(await screen.findByRole('switch', { name: 'E-bikes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-bikes was not switched on: The selected module is invalid.',
    );
  });

  it('says when the settings could not be loaded', async () => {
    server.use(
      http.get('/api/settings/main', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );
    renderApp('/settings?tab=modules');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load modules: Server error',
    );
  });
});

describe('module placeholder route', () => {
  it('does not open for a module that does not exist', async () => {
    signIn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderApp('/modules/crypto');

    await vi.waitFor(() =>
      expect(screen.queryByText(/has not been rebuilt yet/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
