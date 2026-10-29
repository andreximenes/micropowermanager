import { daysSince, standingOf } from './standing';

import { listedPersonFixture } from '@/test/fixtures';

const today = new Date(2026, 9, 28);

describe('standingOf', () => {
  it('shows a customer without contracts as having none, whatever else is true', () => {
    expect(
      standingOf(listedPersonFixture({ contracts_count: 0, overdue_since: '2026-10-01' }), today),
    ).toEqual({ status: 'neutral', label: 'No contract' });
  });

  it('counts the days since the oldest overdue installment', () => {
    expect(
      standingOf(listedPersonFixture({ overdue_since: '2026-10-02 00:00:00' }), today),
    ).toEqual({
      status: 'error',
      label: 'Overdue 26 days',
    });
  });

  it('never shows fewer than one overdue day', () => {
    expect(standingOf(listedPersonFixture({ overdue_since: '2026-10-28' }), today).label).toBe(
      'Overdue 1 day',
    );
  });

  it('shows a customer who owes nothing more as paid off', () => {
    expect(
      standingOf(listedPersonFixture({ outstanding_amount: 0, is_active: false }), today),
    ).toEqual({
      status: 'info',
      label: 'Paid off',
    });
  });

  it('tells paying and not paying customers apart by their recent payments', () => {
    expect(standingOf(listedPersonFixture({ is_active: true }), today)).toEqual({
      status: 'success',
      label: 'Paying',
    });
    expect(standingOf(listedPersonFixture({ is_active: false }), today)).toEqual({
      status: 'warning',
      label: 'Not paying',
    });
  });

  it('uses the current date by default', () => {
    expect(standingOf(listedPersonFixture()).label).toBe('Paying');
  });
});

describe('daysSince', () => {
  it('counts calendar days and ignores the time of day', () => {
    expect(daysSince('2026-10-27T23:59:00Z', new Date(2026, 9, 28, 0, 1))).toBe(1);
  });
});
