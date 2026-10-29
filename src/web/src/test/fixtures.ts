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
