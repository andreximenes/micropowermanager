import { previewPlan } from './salePlan';

const today = new Date(2026, 0, 31, 12);

describe('previewPlan', () => {
  it('splits the financed amount evenly when it divides exactly', () => {
    const preview = previewPlan(
      { totalCost: 1200, downPayment: 0, rateCount: 12, rateType: 'monthly' },
      today,
    );

    expect(preview).toMatchObject({ financed: 1200, installment: 100, lastInstallment: 100 });
  });

  it('rounds installments down and lets the last one absorb the remainder', () => {
    const preview = previewPlan(
      { totalCost: 1000, downPayment: 0, rateCount: 3, rateType: 'monthly' },
      today,
    );

    expect(preview).toMatchObject({ financed: 1000, installment: 333, lastInstallment: 334 });
  });

  it('subtracts the down payment before splitting', () => {
    const preview = previewPlan(
      { totalCost: 1200, downPayment: 200, rateCount: 4, rateType: 'monthly' },
      today,
    );

    expect(preview).toMatchObject({ financed: 1000, installment: 250, lastInstallment: 250 });
  });

  it('puts the whole amount in a single installment', () => {
    const preview = previewPlan(
      { totalCost: 999, downPayment: 0, rateCount: 1, rateType: 'weekly' },
      today,
    );

    expect(preview).toMatchObject({ installment: 999, lastInstallment: 999 });
  });

  it('accepts a down payment that covers the whole price', () => {
    const preview = previewPlan(
      { totalCost: 500, downPayment: 500, rateCount: 2, rateType: 'monthly' },
      today,
    );

    expect(preview).toMatchObject({ financed: 0, installment: 0, lastInstallment: 0 });
  });

  it('schedules monthly rates one month apart', () => {
    const preview = previewPlan(
      { totalCost: 1200, downPayment: 0, rateCount: 3, rateType: 'monthly' },
      new Date(2026, 4, 15),
    );

    expect(preview?.firstDue).toEqual(new Date(2026, 5, 15));
    expect(preview?.paidOffBy).toEqual(new Date(2026, 7, 15));
  });

  it('schedules weekly rates seven days apart', () => {
    const preview = previewPlan(
      { totalCost: 1200, downPayment: 0, rateCount: 4, rateType: 'weekly' },
      new Date(2026, 4, 15),
    );

    expect(preview?.firstDue).toEqual(new Date(2026, 4, 22));
    expect(preview?.paidOffBy).toEqual(new Date(2026, 5, 12));
  });

  it('does not change the date it is given', () => {
    const start = new Date(2026, 4, 15);

    previewPlan({ totalCost: 100, downPayment: 0, rateCount: 2, rateType: 'monthly' }, start);

    expect(start).toEqual(new Date(2026, 4, 15));
  });

  it('defaults to today', () => {
    const preview = previewPlan({
      totalCost: 100,
      downPayment: 0,
      rateCount: 1,
      rateType: 'weekly',
    });

    expect(preview?.firstDue.getTime()).toBeGreaterThan(Date.now());
  });

  it.each([
    ['no installments', { totalCost: 1200, downPayment: 0, rateCount: 0 }],
    ['a negative count', { totalCost: 1200, downPayment: 0, rateCount: -2 }],
    ['an empty count', { totalCost: 1200, downPayment: 0, rateCount: Number.NaN }],
    ['a fractional count', { totalCost: 1200, downPayment: 0, rateCount: 2.5 }],
    ['a down payment above the price', { totalCost: 100, downPayment: 200, rateCount: 2 }],
    ['an empty price', { totalCost: Number.NaN, downPayment: 0, rateCount: 2 }],
    ['an empty down payment', { totalCost: 100, downPayment: Number.NaN, rateCount: 2 }],
    ['an infinite price', { totalCost: Number.POSITIVE_INFINITY, downPayment: 0, rateCount: 2 }],
  ])('returns null for %s', (_, plan) => {
    expect(previewPlan({ ...plan, rateType: 'monthly' }, today)).toBeNull();
  });
});
