import { activeContracts, customerStanding, summarizeContract } from './contractSummary';

import { contractFixture, rateFixture } from '@/test/fixtures';

const today = new Date('2026-06-15T12:00:00Z');

describe('summarizeContract', () => {
  it('counts paid rates, amounts and the next open rate in due-date order', () => {
    const contract = contractFixture({
      rates: [
        rateFixture({ id: 3, rate_cost: 400, remaining: 400, due_date: '2026-09-01' }),
        rateFixture({ id: 1, rate_cost: 400, remaining: 0, due_date: '2026-05-01' }),
        rateFixture({ id: 2, rate_cost: 400, remaining: 150, due_date: '2026-07-01' }),
      ],
    });

    const summary = summarizeContract(contract, today);

    expect(summary).toMatchObject({
      paidRates: 1,
      totalRates: 3,
      paidAmount: 650,
      outstanding: 550,
      overdue: false,
    });
    expect(summary.nextRate?.id).toBe(2);
    expect(summary.contract).toBe(contract);
  });

  it('flags an open rate due before today as overdue', () => {
    const contract = contractFixture({
      rates: [rateFixture({ remaining: 10, due_date: '2026-06-14 00:00:00' })],
    });

    expect(summarizeContract(contract, today).overdue).toBe(true);
  });

  it('does not flag a rate due today', () => {
    const contract = contractFixture({ rates: [rateFixture({ due_date: '2026-06-15' })] });

    expect(summarizeContract(contract, today).overdue).toBe(false);
  });

  it('ignores past rates that are already paid', () => {
    const contract = contractFixture({
      rates: [rateFixture({ remaining: 0, due_date: '2020-01-01' })],
    });

    expect(summarizeContract(contract, today)).toMatchObject({
      overdue: false,
      outstanding: 0,
      nextRate: null,
    });
  });

  it('summarizes a contract without rates', () => {
    expect(summarizeContract(contractFixture({ rates: [] }), today)).toMatchObject({
      paidRates: 0,
      totalRates: 0,
      paidAmount: 0,
      outstanding: 0,
      nextRate: null,
      overdue: false,
    });
  });

  it('does not reorder the contract rates', () => {
    const rates = [
      rateFixture({ id: 2, due_date: '2026-09-01' }),
      rateFixture({ id: 1, due_date: '2026-07-01' }),
    ];

    summarizeContract(contractFixture({ rates }), today);

    expect(rates.map((rate) => rate.id)).toEqual([2, 1]);
  });
});

describe('activeContracts', () => {
  it('drops cancelled contracts and lists the newest first', () => {
    const contracts = [
      contractFixture({ id: 1, created_at: '2025-01-01' }),
      contractFixture({ id: 2, created_at: '2025-06-01', deleted_at: '2025-07-01' }),
      contractFixture({ id: 3, created_at: '2025-03-01' }),
      contractFixture({ id: 4, created_at: null }),
    ];

    expect(activeContracts(contracts).map((contract) => contract.id)).toEqual([3, 1, 4]);
  });
});

describe('customerStanding', () => {
  const summary = (overrides: Parameters<typeof contractFixture>[0]) =>
    summarizeContract(contractFixture(overrides), today);
  const paidOff = { rates: [rateFixture({ remaining: 0 })] };
  const onTrack = { rates: [rateFixture({ due_date: '2099-01-01' })] };
  const overdue = { rates: [rateFixture({ due_date: '2020-01-01' })] };
  const energyService = { payment_type: 'energy_service' as const, rates: [] };

  it('has no contract without summaries', () => {
    expect(customerStanding([])).toBe('no-contract');
  });

  it('is overdue when any contract is overdue', () => {
    expect(customerStanding([summary(paidOff), summary(overdue)])).toBe('overdue');
  });

  it('is paid off when every installment plan is settled', () => {
    expect(customerStanding([summary(paidOff), summary(energyService)])).toBe('paid-off');
  });

  it('is on track while an installment plan is still open', () => {
    expect(customerStanding([summary(paidOff), summary(onTrack)])).toBe('on-track');
  });

  it('is on track with only energy-as-a-service contracts', () => {
    expect(customerStanding([summary(energyService)])).toBe('on-track');
  });
});
