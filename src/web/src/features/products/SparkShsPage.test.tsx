import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { SparkShsPage } from './SparkShsPage';

import {
  productFixture,
  signIn,
  sparkShsCredentialsFixture,
  syncSettingsFixture,
} from '@/test/fixtures';
import { createGate } from '@/test/gate';
import { renderApp, renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

const rule = {
  id: 4,
  pattern: 'spark_steady',
  appliance_id: 3,
  appliance: { id: 3, name: 'Solar Kit' },
};

type PluginData = {
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  rules?: unknown[];
};

/** Answers the page's reads and records every write. */
function pluginHandlers({
  credentials = sparkShsCredentialsFixture(),
  settings = syncSettingsFixture(),
  rules = [rule],
}: PluginData = {}) {
  const writes: { method: string; path: string; body?: unknown }[] = [];
  const record = async (request: Request) => {
    const text = await request.text();
    writes.push({
      method: request.method,
      path: new URL(request.url).pathname.replace('/api/spark-shs', ''),
      body: text ? JSON.parse(text) : undefined,
    });
  };
  server.use(
    http.get('/api/spark-shs/credentials', () => HttpResponse.json({ data: credentials })),
    http.get('/api/spark-shs/sync/settings', () => HttpResponse.json({ data: settings })),
    http.get('/api/spark-shs/sync/kit-type-mappings', () => HttpResponse.json({ data: rules })),
    http.get('/api/appliances', () =>
      HttpResponse.json({
        data: [
          productFixture(),
          productFixture({ id: 9, name: 'Fan', appliance_type_id: 3, appliance_type: null }),
        ],
      }),
    ),
    http.put('/api/spark-shs/credentials', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { ...credentials, client_id: 'client-2' } });
    }),
    http.post('/api/spark-shs/credentials/check', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ valid: true });
    }),
    http.put('/api/spark-shs/sync/settings', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: { ...settings, ...(writes.at(-1)?.body as object) } });
    }),
    http.post('/api/spark-shs/sync/kit-type-mappings', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: rule });
    }),
    http.put('/api/spark-shs/sync/kit-type-mappings/:id', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ data: rule });
    }),
    http.delete('/api/spark-shs/sync/kit-type-mappings/:id', async ({ request }) => {
      await record(request);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return writes;
}

const card = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('.rounded-lg') as HTMLElement);

describe('SparkShsPage', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the stored credentials without the secret and tests them as stored', async () => {
    const writes = pluginHandlers();
    const { user } = renderApp('/spark-shs');

    await screen.findByRole('heading', { name: 'Credentials' });
    const credentials = card('Credentials');
    expect(credentials.getByText('Set up')).toBeInTheDocument();
    expect(credentials.getByText('client-1')).toBeInTheDocument();
    expect(credentials.getByText('Stored, encrypted')).toBeInTheDocument();
    expect(credentials.getByText('Production')).toBeInTheDocument();

    await user.click(credentials.getByRole('button', { name: 'Test connection' }));
    expect(await credentials.findByText(/Connection works/)).toBeInTheDocument();
    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/credentials/check',
        body: {
          client_id: 'client-1',
          client_secret: '',
          audience: 'production',
          auth_url: 'https://auth.example.com/oauth/token',
          api_url: 'https://api.example.com/v1',
        },
      },
    ]);
  });

  it.each([
    [HttpResponse.json({ valid: false }), /Spark refused these credentials/],
    [HttpResponse.json({ message: 'Service unavailable' }, { status: 503 }), /Could not reach/],
    [
      HttpResponse.json({ message: 'Are URLs correct?' }, { status: 502 }),
      'The test failed: Are URLs correct?',
    ],
  ])('reports a failed connection test', async (response, message) => {
    pluginHandlers();
    server.use(http.post('/api/spark-shs/credentials/check', () => response));
    const { user } = renderApp('/spark-shs');

    await screen.findByRole('heading', { name: 'Credentials' });
    await user.click(card('Credentials').getByRole('button', { name: 'Test connection' }));
    expect(await card('Credentials').findByText(message)).toBeInTheDocument();
  });

  it('asks to set up credentials that are missing', async () => {
    pluginHandlers({
      credentials: sparkShsCredentialsFixture({ client_id: null, has_client_secret: false }),
    });
    const { user } = renderApp('/spark-shs');

    await screen.findByRole('heading', { name: 'Credentials' });
    expect(card('Credentials').getByText('Not set up')).toBeInTheDocument();
    expect(card('Credentials').getByRole('button', { name: 'Test connection' })).toBeDisabled();
    await user.click(card('Credentials').getByRole('button', { name: 'Set up credentials' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Spark cloud credentials' }));
    expect(sheet.getByText('No secret is stored yet.')).toBeInTheDocument();
    expect(sheet.getByLabelText('Client secret *')).toBeInTheDocument();
  });

  it('edits the credentials, keeping the stored secret when left blank', async () => {
    const writes = pluginHandlers();
    const { user } = renderApp('/spark-shs');

    await user.click(await screen.findByRole('button', { name: 'Edit credentials' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Spark cloud credentials' }));
    expect(sheet.getByText('A secret is stored — leave blank to keep it.')).toBeInTheDocument();

    const clientId = sheet.getByRole('textbox', { name: 'Client ID *' });
    await user.clear(clientId);
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(await sheet.findByText('Enter the client ID.')).toBeInTheDocument();

    await user.type(clientId, 'client-2');
    await user.click(sheet.getByRole('radio', { name: 'Development (staging)' }));
    await user.click(sheet.getByRole('button', { name: 'Test connection' }));
    expect(await sheet.findByText(/Connection works/)).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const sent = {
      client_id: 'client-2',
      client_secret: '',
      audience: 'development',
      auth_url: 'https://auth.example.com/oauth/token',
      api_url: 'https://api.example.com/v1',
    };
    expect(writes).toEqual([
      { method: 'POST', path: '/credentials/check', body: sent },
      { method: 'PUT', path: '/credentials', body: sent },
    ]);
    expect(card('Credentials').getByText('client-2')).toBeInTheDocument();
  });

  it('asks for the secret again when the auth URL changes, and shows server errors', async () => {
    pluginHandlers();
    server.use(
      http.put('/api/spark-shs/credentials', () =>
        HttpResponse.json(
          {
            message: 'Enter the client secret.',
            errors: { client_secret: ['Enter the client secret.'] },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/spark-shs');

    await user.click(await screen.findByRole('button', { name: 'Edit credentials' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Spark cloud credentials' }));
    await user.click(sheet.getByText('Advanced: API addresses'));
    const authUrl = sheet.getByRole('textbox', { name: 'Auth URL *' });
    await user.clear(authUrl);
    await user.type(authUrl, 'nope');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(await sheet.findByText('Enter a full address, such as https://…')).toBeInTheDocument();

    await user.clear(authUrl);
    await user.type(authUrl, 'https://other.example.com/token');
    expect(sheet.getByText('The auth URL changed, so enter the secret again.')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(await sheet.findByText('Enter the client secret.')).toBeInTheDocument();
    expect(sheet.getByRole('alert')).toHaveTextContent(
      'The credentials were not saved: Enter the client secret.',
    );
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches sync on and off, and puts the switch back when saving fails', async () => {
    const writes = pluginHandlers({ settings: syncSettingsFixture({ is_enabled: false }) });
    const { user } = renderApp('/spark-shs');

    const toggle = await screen.findByRole('switch', { name: 'Enabled' });
    expect(card('Kit sync').getByRole('button', { name: 'Sync now' })).toBeDisabled();
    expect(card('Kit sync').getByText('No sync has run yet.')).toBeInTheDocument();
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    await user.selectOptions(
      card('Kit sync').getByRole('combobox', { name: 'Run every' }),
      '12 hours',
    );
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes.map((write) => write.body)).toEqual([
      { is_enabled: true, interval_hours: 6, untyped_kit_appliance_id: null },
      { is_enabled: true, interval_hours: 12, untyped_kit_appliance_id: null },
    ]);

    const gate = createGate();
    server.use(
      http.put('/api/spark-shs/sync/settings', async () => {
        await gate.promise;
        return HttpResponse.json({ message: 'Server error' }, { status: 500 });
      }),
    );
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    gate.open();
    expect(
      await card('Kit sync').findByText('The setting was not saved: Server error'),
    ).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('gives kits without a type a solar product, or skips them, keeping the other settings', async () => {
    const writes = pluginHandlers({ settings: syncSettingsFixture({ is_enabled: false }) });
    const { user } = renderApp('/spark-shs');

    await screen.findByRole('heading', { name: 'Kit type rules' });
    const select = await card('Kit type rules').findByRole('combobox', {
      name: 'Kits without a type become',
    });
    expect(select).toHaveValue('');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Skip them', 'Solar Kit']);

    await user.selectOptions(select, 'Solar Kit');
    await waitFor(() => expect(select).toHaveValue('3'));
    await user.selectOptions(
      card('Kit sync').getByRole('combobox', { name: 'Run every' }),
      '12 hours',
    );
    await user.selectOptions(select, 'Skip them');
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes.map((write) => write.body)).toEqual([
      { is_enabled: false, interval_hours: 6, untyped_kit_appliance_id: 3 },
      { is_enabled: false, interval_hours: 12, untyped_kit_appliance_id: 3 },
      { is_enabled: false, interval_hours: 12, untyped_kit_appliance_id: null },
    ]);
  });

  it('reports an untyped kit product that was not saved', async () => {
    pluginHandlers();
    server.use(
      http.put('/api/spark-shs/sync/settings', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 }),
      ),
    );
    const { user } = renderApp('/spark-shs');

    await screen.findByRole('heading', { name: 'Kit type rules' });
    const select = await card('Kit type rules').findByRole('combobox', {
      name: 'Kits without a type become',
    });
    await user.selectOptions(select, 'Solar Kit');

    expect(
      await card('Kit type rules').findByText('The setting was not saved: Server error'),
    ).toBeInTheDocument();
    expect(select).toHaveValue('');
  });

  it('keeps an interval set elsewhere in the list', async () => {
    pluginHandlers({ settings: syncSettingsFixture({ interval_hours: 72 }) });
    renderApp('/spark-shs');

    expect(await screen.findByRole('combobox', { name: 'Run every' })).toHaveDisplayValue('3 days');
  });

  it('runs a sync, shows progress inline and then the result with its warnings', async () => {
    let reads = 0;
    pluginHandlers();
    server.use(
      http.post('/api/spark-shs/sync', () => HttpResponse.json({ queued: true }, { status: 202 })),
      http.get('/api/spark-shs/sync/settings', () => {
        reads += 1;
        return HttpResponse.json({
          data:
            reads < 3
              ? syncSettingsFixture()
              : syncSettingsFixture({
                  last_sync_at: '2026-10-29T06:00:00Z',
                  last_sync_status: 'success',
                  last_sync_result: {
                    created: 12,
                    existing: 488,
                    unmatched_kit_types: { 'STEADY-V3-NG': 2, 'LAMP-2': 1 },
                    conflicts: ['6380331412'],
                  },
                }),
        });
      }),
    );
    const { user } = renderWithProviders(<SparkShsPage syncPollMs={1} />);

    await user.click(await screen.findByRole('button', { name: 'Sync now' }));
    expect(await screen.findByRole('button', { name: 'Syncing…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/you can keep working/);
    // The rest of the page stays usable during the sync.
    expect(screen.getByRole('switch', { name: 'Enabled' })).toBeEnabled();

    expect(await screen.findByText('Finished with warnings')).toBeInTheDocument();
    const sync = card('Kit sync');
    expect(sync.getByText('12')).toBeInTheDocument();
    expect(sync.getByText('488')).toBeInTheDocument();
    expect(sync.getByText('3')).toBeInTheDocument();
    expect(sync.getByText('conflict')).toBeInTheDocument();
    expect(sync.getByText(/Kit types without a rule/)).toHaveTextContent(
      'Kit types without a rule: STEADY-V3-NG (2 kits), LAMP-2 (1 kit). Add a rule below and sync again.',
    );
    expect(sync.getByText(/6380331412/)).toBeInTheDocument();
  });

  it('says when the sync is still running after waiting, or did not start', async () => {
    pluginHandlers();
    server.use(
      http.post('/api/spark-shs/sync', () => HttpResponse.json({ queued: true }, { status: 202 })),
    );
    const { user } = renderWithProviders(<SparkShsPage syncPollMs={0} />);

    await user.click(await screen.findByRole('button', { name: 'Sync now' }));
    expect(
      await screen.findByText(/still running in the background/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    server.use(
      http.post('/api/spark-shs/sync', () =>
        HttpResponse.json(
          { message: 'Kit synchronization is disabled. Enable it first.' },
          { status: 422 },
        ),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(
      await screen.findByText(
        'The sync did not start: Kit synchronization is disabled. Enable it first.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a failed sync', async () => {
    pluginHandlers({
      settings: syncSettingsFixture({
        last_sync_at: '2026-10-29T06:00:00Z',
        last_sync_status: 'failed',
        last_sync_result: { error: 'Spark refused the token' },
      }),
    });
    renderApp('/spark-shs');

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Spark refused the token')).toBeInTheDocument();
  });

  it('shows a clean sync as finished', async () => {
    pluginHandlers({
      settings: syncSettingsFixture({
        last_sync_at: '2026-10-29T06:00:00Z',
        last_sync_status: 'success',
        last_sync_result: { created: 0, existing: 46, unmatched_kit_types: [], conflicts: [] },
      }),
    });
    renderApp('/spark-shs');

    expect(await screen.findByText('Finished')).toBeInTheDocument();
    expect(screen.getByText('conflicts')).toBeInTheDocument();
  });

  it('adds, edits and deletes kit type rules with solar home system products only', async () => {
    const writes = pluginHandlers();
    const { user } = renderApp('/spark-shs');

    const rules = await screen.findByRole('table', { name: 'Kit type rules' });
    expect(within(rules).getByRole('row', { name: /spark_steady/ })).toHaveTextContent('Solar Kit');

    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    let sheet = within(await screen.findByRole('dialog', { name: 'New kit type rule' }));
    await user.click(sheet.getByRole('button', { name: 'Save rule' }));
    expect(await sheet.findByText(/Enter part of the kit type/)).toBeInTheDocument();
    const product = sheet.getByRole('combobox', { name: 'Becomes product' });
    expect(within(product).queryByText('Fan')).not.toBeInTheDocument();
    await user.type(sheet.getByRole('textbox', { name: 'Kit type pattern *' }), 'LAMP-2');
    await user.click(sheet.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit rule spark_steady' }));
    sheet = within(await screen.findByRole('dialog', { name: 'Edit kit type rule' }));
    await waitFor(() =>
      expect(sheet.getByRole('combobox', { name: 'Becomes product' })).toHaveValue('3'),
    );
    await user.selectOptions(sheet.getByRole('combobox', { name: 'Becomes product' }), '');
    await user.click(sheet.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete rule spark_steady' }));
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Delete the rule spark_steady?' }),
    );
    await user.click(dialog.getByRole('button', { name: 'Delete rule' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/sync/kit-type-mappings',
        body: { pattern: 'LAMP-2', appliance_id: null },
      },
      {
        method: 'PUT',
        path: '/sync/kit-type-mappings/4',
        body: { pattern: 'spark_steady', appliance_id: null },
      },
      { method: 'DELETE', path: '/sync/kit-type-mappings/4', body: undefined },
    ]);
  });

  it('shows an invalid pattern next to the field', async () => {
    pluginHandlers({ rules: [] });
    server.use(
      http.post('/api/spark-shs/sync/kit-type-mappings', () =>
        HttpResponse.json(
          {
            message: 'The pattern is not a valid regular expression.',
            errors: { pattern: ['The pattern is not a valid regular expression.'] },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/spark-shs');

    expect(
      await screen.findByText('No rules yet. Without one, synced kits get no product.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add rule' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'New kit type rule' }));
    await user.type(sheet.getByRole('textbox', { name: 'Kit type pattern *' }), '(');
    await user.click(sheet.getByRole('button', { name: 'Save rule' }));
    expect(
      await sheet.findByText('The pattern is not a valid regular expression.'),
    ).toBeInTheDocument();
    expect(sheet.getByRole('alert')).toHaveTextContent(
      'The rule was not saved: The pattern is not a valid regular expression.',
    );
    await user.click(sheet.getByRole('button', { name: 'Cancel' }));
  });

  it('reports what cannot be loaded', async () => {
    server.use(
      http.get('/api/spark-shs/credentials', () =>
        HttpResponse.json({ message: 'This action is unauthorized.' }, { status: 403 }),
      ),
    );
    renderApp('/spark-shs');

    expect(
      await screen.findByText(
        'Could not load the Spark SHS settings: This action is unauthorized.',
      ),
    ).toBeInTheDocument();
  });

  it('reports sync settings and rules that cannot be loaded', async () => {
    pluginHandlers();
    server.use(
      http.get('/api/spark-shs/sync/settings', () =>
        HttpResponse.json({ message: 'Down' }, { status: 500 }),
      ),
      http.get('/api/spark-shs/sync/kit-type-mappings', () =>
        HttpResponse.json({ message: 'Gone' }, { status: 500 }),
      ),
    );
    renderApp('/spark-shs');

    expect(await screen.findByText('Could not load kit sync: Down')).toBeInTheDocument();
    expect(await screen.findByText('Could not load the rules: Gone')).toBeInTheDocument();
  });
});
