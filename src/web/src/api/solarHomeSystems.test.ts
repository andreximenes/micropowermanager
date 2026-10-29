import { http, HttpResponse } from 'msw';

import {
  checkDeviceMapping,
  countSolarHomeSystems,
  createSolarHomeSystems,
  deleteSolarHomeSystem,
  fetchDeviceCapabilities,
  fetchShsManufacturers,
  fetchSolarHomeSystem,
  fetchSolarHomeSystems,
  fetchSolarHomeSystemTransactions,
  generateDeviceToken,
  updateSolarHomeSystem,
} from './solarHomeSystems';

import { paginator, signIn, solarHomeSystemFixture } from '@/test/fixtures';
import { server } from '@/test/server';

const queryOf = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

describe('solar home systems API', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists with the query given and reads an unknown mapping status as unknown', async () => {
    let query: Record<string, string> = {};
    server.use(
      http.get('/api/solar-home-systems', ({ request }) => {
        query = queryOf(request);
        const raw = solarHomeSystemFixture();
        return HttpResponse.json(
          paginator([{ ...raw, device: { ...raw.device, manufacturer_mapping_status: 'odd' } }]),
        );
      }),
    );

    const page = await fetchSolarHomeSystems({ term: '6380', sort_by: 'owner', per_page: 15 });

    expect(query).toEqual({ term: '6380', sort_by: 'owner', per_page: '15' });
    expect(page.data[0]?.device?.manufacturer_mapping_status).toBe('unknown');
  });

  it('counts all devices and those in stock', async () => {
    const queries: Record<string, string>[] = [];
    server.use(
      http.get('/api/solar-home-systems', ({ request }) => {
        queries.push(queryOf(request));
        return HttpResponse.json({ total: 612 });
      }),
      http.get('/api/devices', ({ request }) => {
        queries.push(queryOf(request));
        return HttpResponse.json({ total: 181 });
      }),
    );

    await expect(countSolarHomeSystems()).resolves.toEqual({ total: 612, inStock: 181 });
    expect(queries).toContainEqual({
      device_type: 'solar_home_system',
      unassigned: '1',
      per_page: '1',
    });
  });

  it('reads one with its tokens and its payments by page', async () => {
    let query: Record<string, string> = {};
    server.use(
      http.get('/api/solar-home-systems/58', () =>
        HttpResponse.json({ data: solarHomeSystemFixture() }),
      ),
      http.get('/api/solar-home-systems/58/transactions', ({ request }) => {
        query = queryOf(request);
        return HttpResponse.json(
          paginator([
            {
              id: 1,
              amount: '10.00',
              payment_service: null,
              payment_type: 'energy',
              created_at: '2026-10-28T00:00:00Z',
              paid_for: { token: '1', token_amount: '30', token_unit: 'days' },
            },
          ]),
        );
      }),
    );

    await expect(fetchSolarHomeSystem(58)).resolves.toMatchObject({
      serial_number: '6380330900',
      tokens: [{ token_amount: 60 }],
    });
    const payments = await fetchSolarHomeSystemTransactions(58, 2, 25);
    expect(query).toEqual({ page: '2', per_page: '25' });
    expect(payments.data[0]).toMatchObject({ amount: 10, paid_for: { token_amount: 30 } });
  });

  it('adds devices, sends only a changed serial and deletes', async () => {
    const bodies: unknown[] = [];
    let deleted = false;
    server.use(
      http.post('/api/solar-home-systems', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: [{ id: 1 }] });
      }),
      http.put('/api/solar-home-systems/58', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { id: 58 } });
      }),
      http.delete('/api/solar-home-systems/58', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await createSolarHomeSystems({ serialNumbers: ['12345678'], manufacturerId: 2, productId: 3 });
    await updateSolarHomeSystem(58, { manufacturerId: 2, productId: 3 });
    await updateSolarHomeSystem(58, { serialNumber: '87654321', manufacturerId: 2, productId: 3 });
    await deleteSolarHomeSystem(58);

    expect(bodies).toEqual([
      { serial_numbers: ['12345678'], manufacturer_id: 2, appliance_id: 3 },
      { manufacturer_id: 2, appliance_id: 3 },
      { serial_number: '87654321', manufacturer_id: 2, appliance_id: 3 },
    ]);
    expect(deleted).toBe(true);
  });

  it('keeps only solar home system manufacturers', async () => {
    server.use(
      http.get('/api/manufacturers', () =>
        HttpResponse.json({
          data: [
            { id: 1, name: 'Meters Inc', type: 'meter' },
            { id: 2, name: 'Spark SHS', type: 'shs' },
          ],
        }),
      ),
    );

    await expect(fetchShsManufacturers()).resolves.toEqual([
      { id: 2, name: 'Spark SHS', type: 'shs' },
    ]);
  });

  it('reads capabilities, checks the mapping and asks for a token', async () => {
    let tokenBody: unknown;
    server.use(
      http.get('/api/devices/291/capabilities', () =>
        HttpResponse.json({
          data: {
            token_generation: true,
            unlock_token: false,
            reset_token: false,
            credit_unit: 'days',
            token_generation_blocked_reason: null,
          },
        }),
      ),
      http.get('/api/devices/291/device-info', () =>
        HttpResponse.json({ data: { supported: true, mapped: true, device: { model: 'X' } } }),
      ),
      http.post('/api/devices/291/token', async ({ request }) => {
        tokenBody = await request.json();
        return HttpResponse.json({
          data: { id: 5, token: '123', token_amount: 30, token_unit: 'days', created_at: null },
        });
      }),
    );

    await expect(fetchDeviceCapabilities(291)).resolves.toMatchObject({ credit_unit: 'days' });
    await expect(checkDeviceMapping(291)).resolves.toEqual({
      supported: true,
      mapped: true,
      device: { model: 'X' },
    });
    await expect(
      generateDeviceToken(291, { type: 'credit', amount: 30, unit: 'days' }),
    ).resolves.toMatchObject({ token: '123' });
    expect(tokenBody).toEqual({ type: 'credit', amount: 30, unit: 'days' });
  });
});
