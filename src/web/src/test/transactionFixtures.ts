import { http, HttpResponse } from 'msw';

import { paginator } from './fixtures';
import { server } from './server';

import type { ListedTransaction, PeriodTotals, TransactionDetail } from '@/api/transactions';

export function listedTransactionFixture(
  overrides: Partial<ListedTransaction> = {},
): ListedTransaction {
  return {
    id: 501,
    amount: 10000,
    type: 'deferred_payment',
    sender: '+2348035550142',
    message: 'SN-100',
    original_transaction_type: 'paystack_transaction',
    created_at: '2026-10-28T09:14:00.000000Z',
    original_transaction: { id: 9, status: 1 },
    device: {
      device_type: 'solar_home_system',
      person: { id: 7, name: 'Amina', surname: 'Bello' },
    },
    ...overrides,
  };
}

export function transactionDetailFixture(
  overrides: Partial<TransactionDetail> = {},
): TransactionDetail {
  return {
    ...listedTransactionFixture(),
    amount: 20000,
    token: { token: '4821-7730-9154', token_amount: 60, token_unit: 'days' },
    original_transaction: {
      id: 9,
      status: 1,
      reference: 'PSK-7Q2M91XA',
      conflicts: [],
    },
    sms: {
      receiver: '+2348062217730',
      body: 'Payment of 20,000 received.',
      status: 2,
      created_at: '2026-10-28T09:15:00.000000Z',
    },
    payment_histories: [
      {
        id: 1,
        amount: 10000,
        payment_type: 'installment',
        paid_for_type: 'appliance_rate',
        paid_for: { appliance_person_id: 21, rate_cost: 10000, due_date: '2026-10-05 00:00:00' },
      },
      {
        id: 2,
        amount: 8000,
        payment_type: 'installment',
        paid_for_type: 'appliance_rate',
        paid_for: { appliance_person_id: 21, rate_cost: 10000, due_date: '2026-10-15 00:00:00' },
      },
      {
        id: 3,
        amount: 2000,
        payment_type: 'energy',
        paid_for_type: 'App\\Models\\Token',
        paid_for: { id: 4 },
      },
    ],
    device: {
      device_type: 'solar_home_system',
      device_serial: '6380331184',
      person: { id: 7, name: 'Chinedu', surname: 'Okafor' },
    },
    ...overrides,
  };
}

export function periodTotals(overrides: Partial<PeriodTotals> = {}): PeriodTotals {
  return { total: 0, amount: 0, confirmed: 0, cancelled: 0, ...overrides };
}

type ListData = {
  rows?: ListedTransaction[];
  total?: number;
  current?: PeriodTotals;
  past?: PeriodTotals;
  providers?: string[];
};

/**
 * Answers every request the transaction list makes, and records the query of each page and
 * analytics request.
 */
export function transactionListHandlers({
  rows = [listedTransactionFixture()],
  total = rows.length,
  current = periodTotals({ total: 412, confirmed: 396, cancelled: 11, amount: 4926000 }),
  past = periodTotals({ total: 380, confirmed: 363, cancelled: 8, amount: 5057000 }),
  providers = ['paystack_transaction', 'cash_transaction'],
}: ListData = {}) {
  const queries: Record<string, string>[] = [];
  const periods: string[] = [];
  server.use(
    http.get('/api/transactions/advanced', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      queries.push(query);
      return HttpResponse.json(
        paginator(rows, {
          page: Number(query.page ?? 1),
          perPage: Number(query.per_page ?? 15),
          total,
        }),
      );
    }),
    http.get('/api/transactions/analytics/:period', ({ params }) => {
      periods.push(String(params.period));
      return HttpResponse.json({ success: true, current, past, analytics: {} });
    }),
    http.get('/api/transaction-providers', () => HttpResponse.json({ data: providers })),
  );
  return { queries, periods, lastQuery: () => queries.at(-1) };
}
