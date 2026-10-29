import { http, HttpResponse } from 'msw';

import { applianceFixture, personFixture, solarHomeSystemFixture } from './fixtures';

import type { ContractLog } from '@/api/contracts';
import type { Person } from '@/api/schemas';

type RateInput = { id: number; rate_cost: number; remaining: number; due_date: string };

/** A contract as the detail endpoint sends it: down payment and one installment paid, one overdue. */
export function contractDetailFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    appliance_id: 3,
    person_id: 7,
    total_cost: 1200,
    rate_count: 4,
    down_payment: 200,
    first_payment_date: null,
    device_serial: 'SN-100',
    payment_type: 'installment',
    minimum_payable_amount: null,
    price_per_day: null,
    created_at: '2020-02-01T10:00:00.000000Z',
    deleted_at: null,
    appliance: applianceFixture(),
    device: { device_type: 'solar_home_system', device_id: 58, device_serial: 'SN-100' },
    totalRemainingAmount: 750,
    totalPayments: 450,
    rateType: 'monthly',
    rates: [
      // Deliberately out of schedule order, as the backend may send them.
      rateInput(3, 250, 250, '2099-01-01 00:00:00'),
      rateInput(1, 200, 0, '2020-02-01 00:00:00'),
      rateInput(2, 250, 0, '2020-03-01 00:00:00'),
      rateInput(5, 250, 250, '2020-04-01 00:00:00'),
      rateInput(4, 250, 250, '2099-02-01 00:00:00'),
    ],
    logs: [],
    ...overrides,
  };
}

export function rateInput(
  id: number,
  rateCost: number,
  remaining: number,
  dueDate: string,
): RateInput {
  return { id, rate_cost: rateCost, remaining, due_date: dueDate };
}

export function energyContractFixture(overrides: Record<string, unknown> = {}) {
  return contractDetailFixture({
    payment_type: 'energy_service',
    total_cost: 0,
    rate_count: 0,
    down_payment: 0,
    price_per_day: 50,
    minimum_payable_amount: 500,
    rates: [],
    ...overrides,
  });
}

export function logFixture(overrides: Partial<ContractLog> = {}): ContractLog {
  return {
    id: 1,
    action: '250 TZS of payment is made',
    created_at: '2026-03-04T09:00:00.000000Z',
    owner: { name: 'Grace Admin' },
    ...overrides,
  };
}

export function paginated<T>(data: T[], currentPage = 1, lastPage = 1) {
  return { data, current_page: currentPage, last_page: lastPage, total: data.length };
}

type ContractData = {
  contract?: ReturnType<typeof contractDetailFixture>;
  person?: Person;
  logs?: ContractLog[];
  tokens?: unknown[];
  providers?: { id: number; name: string }[];
};

/** Every endpoint the contract screen reads, answered from the given data. */
export function contractHandlers({
  contract = contractDetailFixture(),
  person = personFixture(),
  logs = [logFixture()],
  tokens = [],
  providers = [],
}: ContractData = {}) {
  return [
    http.get(`/api/appliances/person/people/detail/${contract.id}`, () =>
      HttpResponse.json({ data: contract }),
    ),
    http.get(`/api/people/${person.id}`, () => HttpResponse.json({ data: person })),
    http.get(`/api/appliances/person/${contract.id}/logs`, () =>
      HttpResponse.json(paginated(logs)),
    ),
    http.get('/api/solar-home-systems/:id', () =>
      HttpResponse.json({
        data: solarHomeSystemFixture({
          manufacturer: { id: 2, name: 'Demo SHS Manufacturer' },
          tokens,
        }),
      }),
    ),
    http.get('/api/appliances/payment/providers', () => HttpResponse.json({ data: providers })),
  ];
}
