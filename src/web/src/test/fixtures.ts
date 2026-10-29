import { http, HttpResponse } from 'msw';

import type {
  Address,
  Appliance,
  Contract,
  CustomerDocument,
  Payment,
  Person,
  Rate,
  StockDevice,
  Ticket,
} from '@/api/schemas';
import type { ListedPerson } from '@/api/people';
import type { Product } from '@/api/products';
import { writeSession, type LoginResponse } from '@/auth/session';

export const ALL_PERMISSIONS = [
  'customers',
  'transactions',
  'appliances',
  'tickets',
  'reports',
  'settings',
];

export function loginResponse(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    access_token: 'token-1',
    expires_in: 3600,
    user: { id: 1, name: 'Grace Admin', email: 'grace@example.com', company_id: 4 },
    roles: ['admin'],
    permissions: ALL_PERMISSIONS,
    ...overrides,
  };
}

export function signIn(overrides: Partial<LoginResponse> = {}) {
  return writeSession(loginResponse(overrides));
}

export function geoAt(latitude: number, longitude: number) {
  return { geo_json: { geometry: { coordinates: [longitude, latitude] as [number, number] } } };
}

export function addressFixture(overrides: Partial<Address> = {}): Address {
  return {
    id: 11,
    email: 'amina@example.com',
    phone: '+255700000001',
    street: 'Kariakoo Street',
    is_primary: 1,
    city: { id: 2, name: 'Dar es Salaam' },
    geo: geoAt(-6.8, 39.28),
    ...overrides,
  };
}

export function personFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: 7,
    name: 'Amina',
    surname: 'Okafor',
    gender: 'female',
    birth_date: null,
    is_active: true,
    created_at: '2025-01-15T10:00:00.000000Z',
    addresses: [addressFixture()],
    devices: [],
    agent: null,
    ...overrides,
  };
}

export function rateFixture(overrides: Partial<Rate> = {}): Rate {
  return { id: 1, rate_cost: 400, remaining: 400, due_date: '2099-01-01', ...overrides };
}

export function applianceFixture(overrides: Partial<Appliance> = {}): Appliance {
  return {
    id: 3,
    name: 'Solar Kit',
    price: 1200,
    appliance_type: { id: 1, name: 'SHS' },
    ...overrides,
  };
}

/** A product as the product list (`GET /api/appliances`) returns it. */
export function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: 3,
    name: 'Solar Kit',
    price: 1200,
    appliance_type_id: 1,
    appliance_type: { id: 1, name: 'SHS' },
    sold_count: 0,
    ...overrides,
  };
}

export function contractFixture(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 21,
    total_cost: 1200,
    rate_count: 3,
    down_payment: null,
    device_serial: 'SN-100',
    payment_type: 'installment',
    price_per_day: null,
    created_at: '2025-02-01T00:00:00.000000Z',
    deleted_at: null,
    appliance: applianceFixture(),
    rates: [
      rateFixture({ id: 1, remaining: 0, due_date: '2020-01-01' }),
      rateFixture({ id: 2, due_date: '2099-01-01' }),
      rateFixture({ id: 3, due_date: '2099-02-01' }),
    ],
    ...overrides,
  };
}

export function paymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 31,
    amount: 400,
    payment_service: 'wavecom_transaction',
    payment_type: 'appliance_rate',
    created_at: '2026-03-04T09:00:00.000000Z',
    transaction: {
      message: null,
      token: { token: 'TOKEN-123', token_amount: null, token_unit: null },
    },
    ...overrides,
  };
}

export function documentFixture(overrides: Partial<CustomerDocument> = {}): CustomerDocument {
  return {
    id: 41,
    name: 'stored-file.pdf',
    original_name: 'National ID.pdf',
    created_at: '2025-03-10T00:00:00.000000Z',
    ...overrides,
  };
}

export function ticketFixture(overrides: Partial<Ticket> = {}): Ticket {
  return { id: 51, title: 'Panel not charging', status: 0, created_at: null, ...overrides };
}

export function stockDeviceFixture(overrides: Partial<StockDevice> = {}): StockDevice {
  return { id: 61, device_serial: 'SN-001', person_id: null, ...overrides };
}

export function page<T>(data: T[]) {
  return { data, current_page: 1, last_page: 1, total: data.length };
}

type CustomerData = {
  person?: Person;
  contracts?: Contract[];
  payments?: Payment[];
  documents?: CustomerDocument[];
  tickets?: Ticket[];
  currency?: string;
};

/** Every endpoint the customer profile reads, answered from the given data. */
export function customerHandlers({
  person = personFixture(),
  contracts = [contractFixture()],
  payments = [paymentFixture()],
  documents = [documentFixture()],
  tickets = [ticketFixture()],
  currency = 'TZS',
}: CustomerData = {}) {
  return [
    http.get(`/api/people/${person.id}`, () => HttpResponse.json({ data: person })),
    http.get('/api/settings/main', () =>
      HttpResponse.json({ data: { company_name: 'Spark', currency } }),
    ),
    http.get(`/api/appliances/person/people/${person.id}`, () =>
      HttpResponse.json({ data: contracts }),
    ),
    http.get(`/api/people/${person.id}/transactions`, () => HttpResponse.json(page(payments))),
    http.get(`/api/people/${person.id}/documents`, () => HttpResponse.json({ data: documents })),
    http.get(`/api/tickets/user/${person.id}`, () => HttpResponse.json(page(tickets))),
  ];
}

export function listedPersonFixture(overrides: Partial<ListedPerson> = {}): ListedPerson {
  return {
    id: 7,
    name: 'Amina',
    surname: 'Okafor',
    is_active: true,
    addresses: [{ phone: '+2348035550142', city: { id: 2, name: 'Kafanchan' } }],
    devices: [{ id: 1, device_type: 'solar_home_system', device_serial: 'SN-100' }],
    agent_sold_appliance: {
      assigned_appliance: { agent: { person: { name: 'Musa', surname: 'Ibrahim' } } },
    },
    latest_payment: { amount: 12000, created_at: '2026-10-16T09:00:00.000000Z' },
    contracts_count: 1,
    outstanding_amount: 800,
    overdue_since: null,
    ...overrides,
  };
}

/** A Laravel paginator page, as `/api/people`, `/api/cities` and `/api/agents` return it. */
export function paginator<T>(
  data: T[],
  { page: currentPage = 1, perPage = 15, total = data.length } = {},
) {
  const from = data.length > 0 ? (currentPage - 1) * perPage + 1 : null;
  return {
    data,
    current_page: currentPage,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
    from,
    to: from === null ? null : from + data.length - 1,
  };
}

type RawSolarHomeSystem = Record<string, unknown> & { device?: Record<string, unknown> | null };

/** A solar home system as `GET /api/solar-home-systems/{id}` sends it: owned, mapped, one token. */
export function solarHomeSystemFixture(overrides: Partial<RawSolarHomeSystem> = {}) {
  return {
    id: 58,
    serial_number: '6380330900',
    manufacturer_id: 2,
    appliance_id: 3,
    created_at: '2026-06-02T08:00:00.000000Z',
    updated_at: '2026-10-28T09:14:00.000000Z',
    manufacturer: { id: 2, name: 'Spark SHS', type: 'shs' },
    appliance: { id: 3, name: 'Solar Kit', appliance_type_id: 1, price: 1200 },
    device: {
      id: 291,
      person_id: 7,
      device_type: 'solar_home_system',
      device_serial: '6380330900',
      manufacturer_mapping_status: 'mapped',
      manufacturer_mapping_checked_at: '2026-10-28T09:00:00.000000Z',
      person: {
        id: 7,
        name: 'Amina',
        surname: 'Bello',
        addresses: [
          {
            phone: '+2348035550142',
            street: '12 Market Road',
            is_primary: 1,
            city: { id: 2, name: 'Kafanchan' },
          },
        ],
      },
      geo: geoAt(9.57621, 8.2985),
    },
    tokens: [
      {
        id: 70,
        token: '4821773091540062',
        token_type: 'time',
        token_amount: 60,
        token_unit: 'days',
        created_at: '2026-10-28T09:14:00.000000Z',
      },
    ],
    ...overrides,
  };
}

export function sparkShsCredentialsFixture(overrides: Record<string, unknown> = {}) {
  return {
    client_id: 'client-1',
    has_client_secret: true,
    auth_url: 'https://auth.example.com/oauth/token',
    api_url: 'https://api.example.com/v1',
    audience: 'production',
    updated_at: '2026-10-14T10:00:00Z',
    ...overrides,
  };
}

/** Kit sync settings as `GET /api/spark-shs/sync/settings` sends them, before any sync ran. */
export function syncSettingsFixture(overrides: Record<string, unknown> = {}) {
  return {
    is_enabled: true,
    interval_hours: 6,
    last_sync_at: null,
    last_sync_status: null,
    last_sync_result: null,
    ...overrides,
  };
}
