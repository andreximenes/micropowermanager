import { http, HttpResponse } from 'msw';

import {
  changePlan,
  fetchContractDetail,
  fetchPaymentProviders,
  startPayment,
  waitForPayment,
} from './contracts';

import { contractDetailFixture, rateInput } from '@/test/contractFixtures';
import { server } from '@/test/server';

function statusSequence(statuses: string[]) {
  let calls = 0;
  server.use(
    http.get('/api/appliances/payment/status/:id', () => {
      const status = statuses[Math.min(calls, statuses.length - 1)];
      calls += 1;
      return HttpResponse.json({ data: { status, processed: status === 'processed' } });
    }),
  );
  return () => calls;
}

describe('fetchContractDetail', () => {
  it('reads money sent as strings and keeps only the day of a due date', async () => {
    server.use(
      http.get('/api/appliances/person/people/detail/21', () =>
        HttpResponse.json({
          data: contractDetailFixture({
            total_cost: '1200.00',
            down_payment: '200.00',
            rates: [
              { ...rateInput(1, 0, 0, '2026-11-28 00:00:00'), rate_cost: '200.00', remaining: '0' },
            ],
          }),
        }),
      ),
    );

    const contract = await fetchContractDetail(21);

    expect(contract.total_cost).toBe(1200);
    expect(contract.down_payment).toBe(200);
    expect(contract.rates[0]).toEqual({
      id: 1,
      rate_cost: 200,
      remaining: 0,
      due_date: '2026-11-28',
    });
  });
});

describe('fetchPaymentProviders', () => {
  it('always offers cash first, since the backend never lists it', async () => {
    server.use(
      http.get('/api/appliances/payment/providers', () =>
        HttpResponse.json({ data: [{ id: 3, name: 'Paystack' }] }),
      ),
    );

    expect(await fetchPaymentProviders()).toEqual([
      { id: 0, name: 'Cash' },
      { id: 3, name: 'Paystack' },
    ]);
  });
});

describe('startPayment', () => {
  it('sends the amount and provider and returns the transaction', async () => {
    let body: unknown;
    server.use(
      http.post('/api/appliances/payment/21', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { appliance_person: {}, transaction_id: 9 } });
      }),
    );

    expect(await startPayment(21, { amount: 250, providerId: 0 })).toEqual({ transaction_id: 9 });
    expect(body).toEqual({ amount: 250, payment_provider: 0 });
  });
});

describe('waitForPayment', () => {
  it('checks until the payment is processed', async () => {
    const calls = statusSequence(['processing', 'processing', 'processed']);

    expect(await waitForPayment(9, { intervalMs: 1 })).toBe('processed');
    expect(calls()).toBe(3);
  });

  it('reports a failed payment', async () => {
    statusSequence(['failed']);

    expect(await waitForPayment(9, { intervalMs: 1 })).toBe('failed');
  });

  it('gives up after the last attempt and reports it as still processing', async () => {
    const calls = statusSequence(['processing']);

    expect(await waitForPayment(9, { intervalMs: 1, attempts: 3 })).toBe('processing');
    expect(calls()).toBe(3);
  });

  it('waits a second between checks by default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = statusSequence(['processing', 'processed']);
      const outcome = waitForPayment(9);

      await vi.waitFor(() => expect(calls()).toBe(1));
      await vi.advanceTimersByTimeAsync(1000);

      expect(await outcome).toBe('processed');
      expect(calls()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('changePlan', () => {
  it('sends the count and cadence only with a new schedule', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put('/api/appliances/person/21/total-cost', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: {} });
      }),
    );

    await changePlan(21, { newTotalCost: 1000 });
    await changePlan(21, { newTotalCost: 1000, schedule: { rateCount: 6, rateType: 'weekly' } });

    expect(bodies).toEqual([
      { new_total_cost: 1000 },
      { new_total_cost: 1000, rate_count: 6, rate_type: 'weekly' },
    ]);
  });
});
