import { http, HttpResponse } from 'msw';

import {
  fetchContracts,
  fetchCustomer,
  fetchDocuments,
  fetchMainSettings,
  fetchPayments,
  fetchStockDevices,
  fetchTickets,
  login,
  saleBody,
  sellProduct,
  type SaleRequest,
} from './customers';

import { readSession, VUEX_KEY } from '@/auth/session';
import {
  contractFixture,
  documentFixture,
  loginResponse,
  page,
  paymentFixture,
  personFixture,
  signIn,
  stockDeviceFixture,
  ticketFixture,
} from '@/test/fixtures';
import { server } from '@/test/server';

const vuex = () => JSON.parse(localStorage.getItem(VUEX_KEY) ?? 'null');
const mapSettings = { id: 1, zoom: 9, latitude: -6.8, longitude: 39.28, provider: 'osm' };

describe('login', () => {
  function loginHandlers(maps: unknown[] = [mapSettings]) {
    const credentials = vi.fn<(body: unknown) => void>();
    const settingsAuthorization = vi.fn<(header: string | null) => void>();
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        credentials(await request.json());
        return HttpResponse.json(loginResponse());
      }),
      http.get('/api/settings/main', ({ request }) => {
        settingsAuthorization(request.headers.get('Authorization'));
        return HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS' } });
      }),
      http.get('/api/map-settings', () => HttpResponse.json({ data: maps })),
    );
    return { credentials, settingsAuthorization };
  }

  it('signs in, stores the session and the legacy settings', async () => {
    const { credentials, settingsAuthorization } = loginHandlers();

    const session = await login('grace@example.com', 'secret');

    expect(credentials).toHaveBeenCalledWith({ email: 'grace@example.com', password: 'secret' });
    expect(session.token).toBe('token-1');
    expect(readSession()).toEqual(session);
    expect(settingsAuthorization).toHaveBeenCalledWith('Bearer token-1');
    expect(vuex().settings).toEqual({
      mainSettings: { companyName: 'Spark', currency: 'TZS', protectedPagePassword: null },
      mapSettings,
    });
  });

  it('leaves the map settings out when the company has none', async () => {
    loginHandlers([]);

    await login('grace@example.com', 'secret');

    expect(vuex().settings).not.toHaveProperty('mapSettings');
  });

  it('rejects with the API error on wrong credentials and stores nothing', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(login('grace@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });
    expect(readSession()).toBeNull();
  });
});

describe('customer reads', () => {
  beforeEach(() => {
    signIn();
  });

  it('fetchMainSettings unwraps the settings', async () => {
    server.use(
      http.get('/api/settings/main', () =>
        HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS', vat: 18 } }),
      ),
    );

    await expect(fetchMainSettings()).resolves.toEqual({ company_name: 'Spark', currency: 'TZS' });
  });

  it('fetchCustomer reads the person by id', async () => {
    server.use(http.get('/api/people/7', () => HttpResponse.json({ data: personFixture() })));

    await expect(fetchCustomer(7)).resolves.toEqual(personFixture());
  });

  it('fetchContracts reads the sold appliances of the person', async () => {
    server.use(
      http.get('/api/appliances/person/people/7', () =>
        HttpResponse.json({ data: [contractFixture()] }),
      ),
    );

    await expect(fetchContracts(7)).resolves.toEqual([contractFixture()]);
  });

  it('fetchPayments requests the given page', async () => {
    const pages: (string | null)[] = [];
    server.use(
      http.get('/api/people/7/transactions', ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page([paymentFixture()]));
      }),
    );

    await expect(fetchPayments(7)).resolves.toEqual(page([paymentFixture()]));
    await fetchPayments(7, 3);

    expect(pages).toEqual(['1', '3']);
  });

  it('fetchDocuments and fetchTickets read the person lists', async () => {
    server.use(
      http.get('/api/people/7/documents', () => HttpResponse.json({ data: [documentFixture()] })),
      http.get('/api/tickets/user/7', () => HttpResponse.json(page([ticketFixture()]))),
    );

    await expect(fetchDocuments(7)).resolves.toEqual([documentFixture()]);
    await expect(fetchTickets(7)).resolves.toEqual(page([ticketFixture()]));
  });

  it('fetchStockDevices asks for unassigned devices and omits an empty serial', async () => {
    const queries: Record<string, string>[] = [];
    server.use(
      http.get('/api/devices', ({ request }) => {
        queries.push(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json(page([stockDeviceFixture()]));
      }),
    );

    await fetchStockDevices(3, '');
    await fetchStockDevices(3, 'SN-0');

    expect(queries).toEqual([
      { appliance_id: '3', unassigned: '1', per_page: '10' },
      { appliance_id: '3', unassigned: '1', serial: 'SN-0', per_page: '10' },
    ]);
  });
});

describe('saleBody', () => {
  const base: Omit<SaleRequest, 'plan'> = {
    userId: 1,
    customerId: 7,
    applianceId: 3,
    deviceSerial: 'SN-001',
    location: { latitude: -6.8, longitude: 39.28 },
  };

  it('builds an installment sale', () => {
    expect(
      saleBody({
        ...base,
        plan: {
          paymentType: 'installment',
          cost: 1200,
          downPayment: 200,
          rateCount: 4,
          rateType: 'weekly',
        },
      }),
    ).toEqual({
      user_id: 1,
      payment_type: 'installment',
      device_serial: 'SN-001',
      points: '-6.8,39.28',
      cost: 1200,
      down_payment: 200,
      rate: 4,
      rate_type: 'weekly',
    });
  });

  it('builds an energy-as-a-service sale without a device or location', () => {
    expect(
      saleBody({
        ...base,
        deviceSerial: null,
        location: null,
        plan: { paymentType: 'energy_service', pricePerDay: 50, minimumPayableAmount: 100 },
      }),
    ).toEqual({
      user_id: 1,
      payment_type: 'energy_service',
      device_serial: null,
      points: null,
      price_per_day: 50,
      minimum_payable_amount: 100,
    });
  });
});

describe('sellProduct', () => {
  it('posts the sale for the appliance and the customer', async () => {
    signIn();
    let body: unknown;
    server.use(
      http.post('/api/appliances/person/3/people/7', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { id: 99 } });
      }),
    );
    const request: SaleRequest = {
      userId: 1,
      customerId: 7,
      applianceId: 3,
      deviceSerial: null,
      location: null,
      plan: { paymentType: 'energy_service', pricePerDay: 50, minimumPayableAmount: 0 },
    };

    await expect(sellProduct(request)).resolves.toEqual({ data: { id: 99 } });
    expect(body).toEqual(saleBody(request));
  });
});
