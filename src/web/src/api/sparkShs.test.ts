import { http, HttpResponse } from 'msw';

import {
  checkSparkShsCredentials,
  deleteKitTypeRule,
  fetchKitTypeRules,
  fetchSparkShsCredentials,
  fetchSyncSettings,
  saveKitTypeRule,
  saveSparkShsCredentials,
  saveSyncSettings,
  startSync,
  waitForSync,
} from './sparkShs';

import { signIn, sparkShsCredentialsFixture, syncSettingsFixture } from '@/test/fixtures';
import { server } from '@/test/server';

const credentials = sparkShsCredentialsFixture();
const settings = syncSettingsFixture;

const input = {
  client_id: 'client-1',
  client_secret: '',
  auth_url: credentials.auth_url,
  api_url: credentials.api_url,
  audience: 'production' as const,
};

describe('Spark SHS API', () => {
  beforeEach(() => {
    signIn();
  });

  it('reads, saves and checks the credentials', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.get('/api/spark-shs/credentials', () => HttpResponse.json({ data: credentials })),
      http.put('/api/spark-shs/credentials', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: credentials });
      }),
      http.post('/api/spark-shs/credentials/check', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ valid: false });
      }),
    );

    await expect(fetchSparkShsCredentials()).resolves.toEqual(credentials);
    await saveSparkShsCredentials(input);
    await expect(checkSparkShsCredentials(input)).resolves.toBe(false);
    expect(bodies).toEqual([input, input]);
  });

  it.each([
    [
      'a full result',
      {
        created: 12,
        existing: 488,
        unmatched_kit_types: { 'LAMP-2': 3 },
        conflicts: ['6380331412'],
      },
      {
        created: 12,
        existing: 488,
        unmatchedKitTypes: [['LAMP-2', 3]],
        conflicts: ['6380331412'],
        error: null,
      },
    ],
    [
      'PHP’s empty map and missing conflicts',
      { created: 1, existing: 0, unmatched_kit_types: [] },
      { created: 1, existing: 0, unmatchedKitTypes: [], conflicts: [], error: null },
    ],
    [
      'a failed sync',
      { error: 'Spark refused' },
      { created: 0, existing: 0, unmatchedKitTypes: [], conflicts: [], error: 'Spark refused' },
    ],
  ])('normalises %s', async (_, raw, expected) => {
    server.use(
      http.get('/api/spark-shs/sync/settings', () =>
        HttpResponse.json({ data: settings({ last_sync_result: raw }) }),
      ),
    );

    expect((await fetchSyncSettings()).last_sync_result).toEqual(expected);
  });

  it('saves the settings and starts a sync', async () => {
    let body: unknown;
    server.use(
      http.put('/api/spark-shs/sync/settings', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: settings({ is_enabled: false }) });
      }),
      http.post('/api/spark-shs/sync', () => HttpResponse.json({ queued: true }, { status: 202 })),
    );

    await expect(saveSyncSettings({ is_enabled: false, interval_hours: 6 })).resolves.toMatchObject(
      { is_enabled: false },
    );
    expect(body).toEqual({ is_enabled: false, interval_hours: 6 });
    await expect(startSync()).resolves.toEqual({ queued: true });
  });

  it('waits until the last sync time changes, or gives up', async () => {
    let reads = 0;
    server.use(
      http.get('/api/spark-shs/sync/settings', () => {
        reads += 1;
        return HttpResponse.json({
          data: settings({ last_sync_at: reads >= 2 ? '2026-10-29T10:00:00Z' : null }),
        });
      }),
    );

    await expect(waitForSync(null, { intervalMs: 1 })).resolves.toMatchObject({
      last_sync_at: '2026-10-29T10:00:00Z',
    });
    await expect(
      waitForSync('2026-10-29T10:00:00Z', { intervalMs: 1, attempts: 2 }),
    ).resolves.toBeNull();
  });

  it('lists, creates, updates and deletes kit type rules', async () => {
    const rule = {
      id: 4,
      pattern: 'spark_steady',
      appliance_id: 2,
      appliance: { id: 2, name: 'Steady' },
    };
    const calls: string[] = [];
    server.use(
      http.get('/api/spark-shs/sync/kit-type-mappings', () => HttpResponse.json({ data: [rule] })),
      http.post('/api/spark-shs/sync/kit-type-mappings', () => {
        calls.push('post');
        return HttpResponse.json({ data: rule });
      }),
      http.put('/api/spark-shs/sync/kit-type-mappings/4', () => {
        calls.push('put');
        return HttpResponse.json({ data: rule });
      }),
      http.delete('/api/spark-shs/sync/kit-type-mappings/4', () => {
        calls.push('delete');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(fetchKitTypeRules()).resolves.toEqual([rule]);
    await saveKitTypeRule(null, { pattern: 'spark_steady', appliance_id: 2 });
    await saveKitTypeRule(4, { pattern: 'spark_steady', appliance_id: null });
    await deleteKitTypeRule(4);
    expect(calls).toEqual(['post', 'put', 'delete']);
  });
});
