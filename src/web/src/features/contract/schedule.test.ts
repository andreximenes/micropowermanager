import {
  canChangePlan,
  canEditRate,
  contractStatus,
  coveredRates,
  daysCovered,
  paymentProblem,
  previewPlanChange,
  rateStatus,
  scheduleOf,
  type ScheduledRate,
} from './schedule';

import { contractDetailSchema } from '@/api/contracts';
import { summarizeContract } from '@/features/customer/contractSummary';
import { contractDetailFixture, energyContractFixture, rateInput } from '@/test/contractFixtures';

const parse = (raw: unknown) => contractDetailSchema.parse(raw);

function rateAt(schedule: ScheduledRate[], index: number): ScheduledRate {
  const rate = schedule[index];
  if (!rate) {
    throw new Error(`No rate at ${index}`);
  }
  return rate;
}
const today = new Date('2026-06-15T12:00:00');

describe('scheduleOf', () => {
  it('orders rates by due date and numbers installments after the down payment', () => {
    const schedule = scheduleOf(parse(contractDetailFixture()));

    expect(schedule.map((rate) => [rate.id, rate.label, rate.isDownPayment])).toEqual([
      [1, 'Down payment', true],
      [2, 'Installment 1', false],
      [5, 'Installment 2', false],
      [3, 'Installment 3', false],
      [4, 'Installment 4', false],
    ]);
  });

  it('numbers from the first rate without a down payment, breaking date ties by id', () => {
    const schedule = scheduleOf(
      parse(
        contractDetailFixture({
          down_payment: null,
          rates: [rateInput(9, 100, 100, '2099-01-01'), rateInput(8, 100, 100, '2099-01-01')],
        }),
      ),
    );

    expect(schedule.map((rate) => [rate.id, rate.label])).toEqual([
      [8, 'Installment 1'],
      [9, 'Installment 2'],
    ]);
  });
});

describe('rateStatus', () => {
  const schedule = scheduleOf(parse(contractDetailFixture()));
  const downPayment = rateAt(schedule, 0);
  const overdue = rateAt(schedule, 2);
  const next = rateAt(schedule, 3);
  const upcoming = rateAt(schedule, 4);

  it('tells paid, overdue, next and upcoming rates apart', () => {
    expect(rateStatus(downPayment, next, today)).toBe('paid');
    expect(rateStatus(overdue, overdue, today)).toBe('overdue');
    expect(rateStatus(next, next, today)).toBe('next');
    expect(rateStatus(upcoming, next, today)).toBe('upcoming');
  });

  it('does not call a rate due today overdue', () => {
    expect(rateStatus({ ...next, due_date: '2026-06-15' }, next, today)).toBe('next');
  });
});

describe('contractStatus', () => {
  const status = (raw: unknown) => contractStatus(summarizeContract(parse(raw), today));

  it('puts a deletion before anything else', () => {
    expect(status(contractDetailFixture({ deleted_at: '2026-01-01T00:00:00Z' }))).toBe('deleted');
  });

  it('flags a contract with an overdue rate', () => {
    expect(status(contractDetailFixture())).toBe('overdue');
  });

  it('calls a fully paid installment plan paid off', () => {
    expect(status(contractDetailFixture({ rates: [rateInput(1, 100, 0, '2020-01-01')] }))).toBe(
      'paid-off',
    );
  });

  it('keeps an energy service contract without payments on track', () => {
    expect(status(energyContractFixture())).toBe('on-track');
  });
});

describe('canEditRate and canChangePlan', () => {
  const contract = parse(contractDetailFixture());
  const schedule = scheduleOf(contract);

  it('only allows untouched installments that are not the down payment', () => {
    expect(schedule.map((rate) => canEditRate(contract, rate))).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
    expect(canEditRate(contract, { ...rateAt(schedule, 2), remaining: 100 })).toBe(false);
  });

  it('allows neither on deleted or energy service contracts', () => {
    const deleted = parse(contractDetailFixture({ deleted_at: '2026-01-01T00:00:00Z' }));
    const energy = parse(energyContractFixture({ rates: [rateInput(1, 100, 100, '2099-01-01')] }));

    expect(canEditRate(deleted, rateAt(scheduleOf(deleted), 2))).toBe(false);
    expect(canChangePlan(deleted, scheduleOf(deleted))).toBe(false);
    expect(canEditRate(energy, rateAt(scheduleOf(energy), 0))).toBe(false);
    expect(canChangePlan(energy, scheduleOf(energy))).toBe(false);
  });

  it('needs at least one untouched rate to change the plan', () => {
    const settled = parse(contractDetailFixture({ rates: [rateInput(1, 100, 40, '2099-01-01')] }));

    expect(canChangePlan(contract, schedule)).toBe(true);
    expect(canChangePlan(settled, scheduleOf(settled))).toBe(false);
  });
});

describe('coveredRates', () => {
  const schedule = scheduleOf(parse(contractDetailFixture()));

  it('settles open rates in schedule order and pays the last one in part', () => {
    expect(
      coveredRates(schedule, 300).map(({ rate, applied, settles }) => [
        rate.label,
        applied,
        settles,
      ]),
    ).toEqual([
      ['Installment 2', 250, true],
      ['Installment 3', 50, false],
    ]);
  });

  it('stops at the end of the schedule', () => {
    expect(coveredRates(schedule, 10_000).map(({ applied }) => applied)).toEqual([250, 250, 250]);
  });

  it('covers nothing for no money', () => {
    expect(coveredRates(schedule, 0)).toEqual([]);
  });
});

describe('daysCovered', () => {
  it('counts whole days at the price per day', () => {
    expect(daysCovered(520, 50)).toBe(10);
    expect(daysCovered(520, null)).toBe(0);
    expect(daysCovered(520, 0)).toBe(0);
  });
});

describe('paymentProblem', () => {
  const contract = parse(contractDetailFixture());
  const schedule = scheduleOf(contract);
  const problem = (amount: number) => paymentProblem(contract, schedule, amount, 'TZS');

  it('rejects nothing and negative amounts', () => {
    expect(problem(0)).toBe('Enter an amount above zero.');
    expect(problem(Number.NaN)).toBe('Enter an amount above zero.');
  });

  it('caps an installment payment at what is left to pay', () => {
    expect(problem(751)).toBe('Only TZS 750 is left to pay.');
    expect(problem(750)).toBeNull();
  });

  it('asks for at least the rest of the next installment', () => {
    expect(problem(249)).toBe('Pay at least TZS 250, what is left of the next installment.');
    expect(problem(250)).toBeNull();
  });

  it('accepts paying off a balance smaller than the next installment', () => {
    const last = parse(contractDetailFixture({ rates: [rateInput(1, 250, 100, '2099-01-01')] }));
    expect(paymentProblem(last, scheduleOf(last), 100, 'TZS')).toBeNull();
  });

  it('holds energy service payments to the minimum only', () => {
    const energy = parse(energyContractFixture());
    expect(paymentProblem(energy, [], 499, 'TZS')).toBe('The minimum payment is TZS 500.');
    expect(paymentProblem(energy, [], 5000, 'TZS')).toBeNull();

    const noMinimum = parse(energyContractFixture({ minimum_payable_amount: null }));
    expect(paymentProblem(noMinimum, [], 1, 'TZS')).toBeNull();
  });
});

describe('previewPlanChange', () => {
  const contract = parse(contractDetailFixture());
  const schedule = scheduleOf(contract);
  const preview = (
    newTotalCost: number,
    rateCount = 3,
    rateType: 'monthly' | 'weekly' = 'monthly',
  ) => previewPlanChange(contract, schedule, { newTotalCost, rateCount, rateType }, today);

  it('spreads a new total over the untouched rates on their dates', () => {
    expect(preview(1000)).toEqual({
      paid: 450,
      outstanding: 550,
      rateCount: 3,
      installment: 183,
      lastInstallment: 184,
      paidOffBy: '2099-02-01',
      reschedules: false,
    });
  });

  it('reschedules after the latest paid rate when the count or cadence changes', () => {
    expect(preview(1050, 6)).toMatchObject({
      outstanding: 600,
      installment: 100,
      reschedules: true,
      paidOffBy: '2020-09-01T12:00:00.000Z',
    });
    expect(preview(1050, 3, 'weekly')).toMatchObject({
      reschedules: true,
      paidOffBy: '2020-03-22T12:00:00.000Z',
    });
  });

  it('starts a fresh schedule from the first payment date, or today, when nothing is paid', () => {
    const unpaid = (firstPaymentDate: string | null) => {
      const fresh = parse(
        contractDetailFixture({
          down_payment: 0,
          first_payment_date: firstPaymentDate,
          rates: [rateInput(1, 600, 600, '2099-01-01')],
        }),
      );
      return previewPlanChange(
        fresh,
        scheduleOf(fresh),
        { newTotalCost: 600, rateCount: 2, rateType: 'monthly' },
        today,
      );
    };

    expect(unpaid('2026-01-10')).toMatchObject({ paidOffBy: '2026-03-10T12:00:00.000Z' });
    expect(unpaid(null)).toMatchObject({ paidOffBy: '2026-08-15T12:00:00.000Z' });
  });

  it('explains totals and counts the backend would refuse', () => {
    expect(preview(449)).toBe('The new total cannot be below what has already been paid.');
    expect(preview(1000.5)).toBe('Enter the new total as a whole amount.');
    expect(preview(Number.NaN)).toBe('Enter the new total as a whole amount.');
    expect(preview(1000, 0)).toBe('Enter at least one installment.');
  });
});
