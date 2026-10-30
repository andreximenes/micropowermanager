import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { readSession } from '@/auth/session';
import { pickOption } from '@/test/combobox';
import { ALL_PERMISSIONS, signIn } from '@/test/fixtures';
import { createGate } from '@/test/gate';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

// Leaflet needs real layout; the fake map lets a test drop the pin or zoom by hand.
vi.mock('@/components/LocationMap', () => ({
  LocationMap: ({
    position,
    zoom,
    label,
    onMove,
    onZoom,
  }: {
    position: { latitude: number; longitude: number };
    zoom: number;
    label: string;
    onMove: (position: { latitude: number; longitude: number }) => void;
    onZoom: (zoom: number) => void;
  }) => (
    <div role="img" aria-label={label}>
      <span>
        Centre {position.latitude},{position.longitude} at {zoom}
      </span>
      <button type="button" onClick={() => onMove({ latitude: 9.581234, longitude: 8.295301 })}>
        Drop pin
      </button>
      <button type="button" onClick={() => onZoom(12)}>
        Zoom map
      </button>
    </div>
  ),
}));

const companySettings = {
  id: 1,
  site_title: 'MPM',
  company_name: 'Spark 234',
  currency: 'NGN',
  country: 'Nigeria',
  language: 'en',
  vat_energy: '7.5',
  vat_appliance: 0,
  usage_type: 'shs',
  sms_gateway_id: 3,
  transaction_sms_enabled: true,
  down_payment_max_token_days: 30,
  created_at: '2026-01-16T11:04:16.000000Z',
};

const mapSettings = { id: 1, zoom: 7, latitude: -2.5, longitude: 32.88, provider: null };

function settingsHandlers() {
  server.use(
    http.get('/api/settings/main', () => HttpResponse.json({ data: companySettings })),
    http.get('/api/settings/currency-list', () =>
      HttpResponse.json({
        data: {
          NGN: { symbol: '₦', name: 'Nigerian Naira' },
          TZS: { symbol: 'TSh', name: 'Tanzanian Shilling' },
          XYZ: { symbol: 'X' },
        },
      }),
    ),
    http.get('/api/countries', () =>
      HttpResponse.json({
        data: [
          { id: 1, country_name: 'Nigeria' },
          { id: 2, country_name: 'Tanzania' },
        ],
      }),
    ),
    http.get('/api/usage-types', () =>
      HttpResponse.json({
        data: [
          { id: 1, name: 'Solar Home System', value: 'shs' },
          { id: 2, name: 'Mini-Grid', value: 'mini-grid' },
        ],
      }),
    ),
    http.get('/api/map-settings', () => HttpResponse.json({ data: [mapSettings] })),
  );
}

describe('Settings — company', () => {
  beforeEach(() => {
    signIn({ permissions: [...ALL_PERMISSIONS, 'users', 'plugins', 'settings.api-keys'] });
    settingsHandlers();
  });

  it('saves the company settings, keeping the SMS columns it does not edit', async () => {
    const saved: unknown[] = [];
    server.use(
      http.put('/api/settings/main/1', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        saved.push(body);
        return HttpResponse.json({ data: { ...companySettings, ...body } });
      }),
    );
    const { user } = renderApp('/settings');

    const name = await screen.findByRole('textbox', { name: 'Company name *' });
    expect(name).toHaveValue('Spark 234');
    const currency = screen.getByRole('combobox', { name: 'Currency *' });
    await waitFor(() => expect(currency).toHaveValue('Nigerian Naira (NGN)'));
    await user.click(currency);
    expect(screen.getByRole('option', { name: 'Nigerian Naira (NGN) · ₦' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'XYZ (XYZ) · X' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'VAT on energy (%) *' })).toHaveValue('7.5');
    expect(screen.getByRole('link', { name: 'Users and roles' })).toHaveAttribute(
      'href',
      '/settings/users',
    );

    await user.clear(name);
    await user.type(name, 'Spark Nigeria');
    await pickOption(user, screen.getByRole('combobox', { name: 'Country' }), 'tanz', 'Tanzania');
    await pickOption(user, currency, 'TZS', 'Tanzanian');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'fr');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Business type' }), 'mini-grid');
    await user.clear(
      screen.getByRole('textbox', { name: 'Most token days a down payment can buy' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved.');
    expect(saved).toEqual([
      {
        company_name: 'Spark Nigeria',
        site_title: 'MPM',
        country: 'Tanzania',
        currency: 'TZS',
        language: 'fr',
        usage_type: 'mini-grid',
        vat_energy: 7.5,
        vat_appliance: 0,
        down_payment_max_token_days: null,
        sms_gateway_id: 3,
        transaction_sms_enabled: true,
      },
    ]);
  });

  it('checks the rates before saving and shows the server refusal', async () => {
    server.use(
      http.put('/api/settings/main/1', () =>
        HttpResponse.json(
          { message: 'Invalid.', errors: { company_name: ['The name is taken.'] } },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/settings');

    const vat = await screen.findByRole('textbox', { name: 'VAT on energy (%) *' });
    await user.clear(vat);
    await user.type(vat, '120');
    await user.clear(screen.getByRole('textbox', { name: 'VAT on products (%) *' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Most token days a down payment can buy' }),
      'x',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Use a number from 0 to 100.')).toBeInTheDocument();
    expect(screen.getByText('Enter a rate, 0 for none.')).toBeInTheDocument();
    expect(
      screen.getByText('Use a whole number of days, or leave it empty for no limit.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('textbox', { name: 'VAT on energy (%) *' })).toHaveValue('7.5');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The settings were not saved: Invalid.',
    );
    expect(screen.getByText('The name is taken.')).toBeInTheDocument();
  });

  it('keeps a stored country the list does not have and says when options fail', async () => {
    server.use(
      http.get('/api/settings/main', () =>
        HttpResponse.json({
          data: { ...companySettings, country: 'Atlantis', down_payment_max_token_days: null },
        }),
      ),
      http.get('/api/settings/currency-list', () =>
        HttpResponse.json({ message: 'Down' }, { status: 500 }),
      ),
    );
    renderApp('/settings');

    expect(await screen.findByRole('combobox', { name: 'Country' })).toHaveValue('Atlantis');
    expect(screen.getByRole('combobox', { name: 'Currency *' })).toHaveValue('NGN');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load every list of choices: Down',
    );
    expect(
      screen.getByRole('textbox', { name: 'Most token days a down payment can buy' }),
    ).toHaveValue('');
  });

  it('says when the settings cannot load', async () => {
    server.use(
      http.get('/api/settings/main', () => HttpResponse.json({ message: 'Boom' }, { status: 500 })),
    );
    renderApp('/settings');

    expect(
      await screen.findByText('Could not load the company settings: Boom'),
    ).toBeInTheDocument();
  });

  it('tells people without the settings right that they cannot change them', async () => {
    signIn({ permissions: ['customers'] });
    renderApp('/settings?tab=plugins');

    expect(
      await screen.findByText(/Your account cannot change company settings/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Settings sections' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users and roles' })).not.toBeInTheDocument();
  });

  it('hides the plugin and API key tabs without their rights', async () => {
    signIn({ permissions: ['settings'] });
    renderApp('/settings?tab=api-keys');

    const tabs = await screen.findByRole('navigation', { name: 'Settings sections' });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Company', 'Map', 'Modules']);
    expect(within(tabs).getByRole('link', { name: 'Company' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('Settings — map', () => {
  beforeEach(() => {
    signIn();
    settingsHandlers();
  });

  it('moves the centre by the pin, the map zoom or typed coordinates and saves it', async () => {
    const saved: unknown[] = [];
    server.use(
      http.put('/api/map-settings/1', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        saved.push(body);
        return HttpResponse.json({ data: [body] });
      }),
    );
    const { user } = renderApp('/settings?tab=map');

    expect(await screen.findByText('Centre -2.5,32.88 at 7')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Drop pin' }));
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('9.58123');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('8.29530');
    await user.click(screen.getByRole('button', { name: 'Zoom map' }));
    expect(screen.getByText('Centre 9.581234,8.295301 at 12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Centre -2.5,32.88 at 7')).toBeInTheDocument();

    const latitude = screen.getByRole('textbox', { name: 'Latitude' });
    await user.clear(latitude);
    expect(screen.getByText('Use a number from -90 to 90.')).toBeInTheDocument();
    expect(save).toBeDisabled();
    await user.type(latitude, '-3');
    expect(screen.getByText('Centre -3,32.88 at 7')).toBeInTheDocument();
    const longitude = screen.getByRole('textbox', { name: 'Longitude' });
    await user.clear(longitude);
    await user.type(longitude, '200');
    expect(screen.getByText('Use a number from -180 to 180.')).toBeInTheDocument();
    await user.clear(longitude);
    await user.type(longitude, '33');
    fireEvent.change(screen.getByRole('slider', { name: /Starting zoom/ }), {
      target: { value: '8' },
    });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Map provider' }),
      'Open Street Map',
    );
    await user.click(save);

    expect(await screen.findByRole('status')).toHaveTextContent('Map settings saved.');
    expect(saved).toEqual([
      { id: 1, zoom: 8, latitude: -3, longitude: 33, provider: 'Open Street Map' },
    ]);
  });

  it('shows why the map settings were not saved', async () => {
    server.use(
      http.put('/api/map-settings/1', () =>
        HttpResponse.json({ message: 'Unauthenticated.' }, { status: 403 }),
      ),
    );
    const { user } = renderApp('/settings?tab=map');

    await user.click(await screen.findByRole('button', { name: 'Zoom map' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The map settings were not saved: Unauthenticated.',
    );
  });

  it('says when there are no map settings or they cannot load', async () => {
    server.use(http.get('/api/map-settings', () => HttpResponse.json({ data: [] })));
    renderApp('/settings?tab=map');

    expect(await screen.findByText(/This company has no map settings yet/)).toBeInTheDocument();
  });

  it('reports a failed load', async () => {
    server.use(
      http.get('/api/map-settings', () => HttpResponse.json({ message: 'Gone' }, { status: 500 })),
    );
    renderApp('/settings?tab=map');

    expect(await screen.findByText('Could not load the map settings: Gone')).toBeInTheDocument();
  });
});

const plugins = [
  { id: 28, name: 'SparkShs', description: 'Spark kits', usage_type: 'shs' },
  { id: 5, name: 'Paystack', description: 'Card payments', usage_type: 'general' },
  { id: 1, name: 'SparkMeter', description: 'Mini-grid meters', usage_type: 'mini-grid' },
  { id: 9, name: 'Steama', description: null, usage_type: 'mini-grid' },
];

describe('Settings — plugins', () => {
  beforeEach(() => {
    signIn({ permissions: [...ALL_PERMISSIONS, 'plugins'] });
    settingsHandlers();
    server.use(
      http.get('/api/mpm-plugins', () => HttpResponse.json({ data: plugins })),
      http.get('/api/plugins', () =>
        HttpResponse.json({
          data: [
            { mpm_plugin_id: 28, status: 1 },
            { mpm_plugin_id: 9, status: 1 },
          ],
        }),
      ),
    );
  });

  it('lists plugins for the business type plus those already on, and searches them', async () => {
    const { user } = renderApp('/settings?tab=plugins');

    const list = await screen.findByRole('list', { name: 'Plugins' });
    expect(
      within(list)
        .getAllByRole('switch')
        .map((toggle) => toggle.getAttribute('aria-label')),
    ).toEqual(['SparkShs', 'Paystack', 'Steama']);
    expect(
      screen.getByText('2 of 3 on. Turning one on adds its menu item and settings.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'SparkShs' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.type(screen.getByRole('searchbox', { name: 'Search plugins' }), 'card');
    await waitFor(() =>
      expect(screen.queryByRole('switch', { name: 'SparkShs' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('switch', { name: 'Paystack' })).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search plugins' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search plugins' }), 'nothing');
    expect(await screen.findByText('No plugin matches this search.')).toBeInTheDocument();
  });

  it('switches a plugin on with the plugin record and refreshes the menu', async () => {
    const gate = createGate();
    const sent: unknown[] = [];
    let enabled = [{ mpm_plugin_id: 28, status: 1 }];
    server.use(
      http.get('/api/plugins', () => HttpResponse.json({ data: enabled })),
      http.put('/api/plugins/5', async ({ request }) => {
        sent.push(await request.json());
        await gate.promise;
        enabled = [...enabled, { mpm_plugin_id: 5, status: 1 }];
        return HttpResponse.json({ data: {} });
      }),
    );
    const { user } = renderApp('/settings?tab=plugins');

    await user.click(await screen.findByRole('switch', { name: 'Paystack' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'SparkShs' })).toBeDisabled());
    gate.open();

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Paystack' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(sent).toEqual([{ ...plugins[1], checked: true }]);
  });

  it('shows why a plugin was not switched off', async () => {
    server.use(
      http.put('/api/plugins/28', () =>
        HttpResponse.json({ message: 'Plugin not found' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/settings?tab=plugins');

    await user.click(await screen.findByRole('switch', { name: 'SparkShs' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'SparkShs was not switched off: Plugin not found',
    );
  });

  it('reports a failed load', async () => {
    server.use(
      http.get('/api/mpm-plugins', () => HttpResponse.json({ message: 'Nope' }, { status: 500 })),
    );
    renderApp('/settings?tab=plugins');

    expect(await screen.findByText('Could not load plugins: Nope')).toBeInTheDocument();
  });
});

describe('Settings — API keys', () => {
  type KeyRow = {
    id: number;
    name: string | null;
    created_at: string | null;
    last_used_at: string | null;
    active: number | boolean;
  };
  const keys: KeyRow[] = [
    {
      id: 3,
      name: 'BI warehouse',
      created_at: '2026-06-02T08:00:00.000000Z',
      last_used_at: '2026-10-28T06:00:00.000000Z',
      active: 1,
    },
    { id: 4, name: null, created_at: null, last_used_at: null, active: false },
  ];

  beforeEach(() => {
    signIn({ permissions: [...ALL_PERMISSIONS, 'settings.api-keys'] });
    settingsHandlers();
  });

  it('lists keys, generates one shown once and deletes another', async () => {
    let list = keys;
    const created: unknown[] = [];
    server.use(
      http.get('/api/api-keys', () => HttpResponse.json({ data: list })),
      http.post('/api/api-keys', async ({ request }) => {
        created.push(await request.json());
        list = [
          { id: 7, name: 'Field app', created_at: null, last_used_at: null, active: true },
          ...list,
        ];
        return HttpResponse.json({ data: { id: 7, token: 'secret-token' } }, { status: 201 });
      }),
      http.delete('/api/api-keys/3', () => {
        list = list.filter((key) => key.id !== 3);
        return HttpResponse.json({ message: 'revoked' });
      }),
    );
    const { user } = renderApp('/settings?tab=api-keys');

    const table = await screen.findByRole('table', { name: 'API keys' });
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('BI warehouse02 Jun 2026');
    expect(rows[1]).toHaveTextContent('Active');
    expect(rows[2]).toHaveTextContent('Unnamed key—NeverInactive');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Field app');
    await user.click(screen.getByRole('button', { name: 'Generate key' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Key “Field app” created. Copy it now.');
    expect(within(notice).getByRole('textbox', { name: 'New API key' })).toHaveValue(
      'secret-token',
    );
    await user.click(within(notice).getByRole('button', { name: 'Copy' }));
    await expect(navigator.clipboard.readText()).resolves.toBe('secret-token');
    expect(created).toEqual([{ name: 'Field app' }]);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    await user.click(within(notice).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Delete BI warehouse' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete key' }));

    await waitFor(() => expect(screen.queryByText('BI warehouse')).not.toBeInTheDocument());
  });

  it('generates an unnamed key and reports refusals', async () => {
    const created: unknown[] = [];
    server.use(
      http.get('/api/api-keys', () => HttpResponse.json({ data: [] })),
      http.post('/api/api-keys', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
      }),
    );
    const { user } = renderApp('/settings?tab=api-keys');

    expect(await screen.findByText(/No API keys yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate key' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The key was not generated: Forbidden',
    );
    expect(created).toEqual([{ name: null }]);
  });

  it('reports a failed load', async () => {
    server.use(
      http.get('/api/api-keys', () => HttpResponse.json({ message: 'Nope' }, { status: 500 })),
    );
    renderApp('/settings?tab=api-keys');

    expect(await screen.findByText('Could not load API keys: Nope')).toBeInTheDocument();
    expect(readSession()).not.toBeNull();
  });
});
