import { nextRun, periodLabel } from './schedule';

describe('nextRun', () => {
  it('runs monthly reports on the 1st at 03:00 UTC', () => {
    expect(nextRun('monthly', new Date('2026-10-29T12:00:00Z')).toISOString()).toBe(
      '2026-11-01T03:00:00.000Z',
    );
    expect(nextRun('monthly', new Date('2026-11-01T01:00:00Z')).toISOString()).toBe(
      '2026-11-01T03:00:00.000Z',
    );
    expect(nextRun('monthly', new Date('2026-12-01T04:00:00Z')).toISOString()).toBe(
      '2027-01-01T03:00:00.000Z',
    );
  });

  it('runs payout reports half an hour after the monthly ones', () => {
    expect(nextRun('outsourced', new Date('2026-10-29T12:00:00Z')).toISOString()).toBe(
      '2026-11-01T03:30:00.000Z',
    );
  });

  it('runs weekly reports on Mondays at 03:00 UTC', () => {
    // 29 Oct 2026 is a Thursday; 2 Nov a Monday.
    expect(nextRun('weekly', new Date('2026-10-29T12:00:00Z')).toISOString()).toBe(
      '2026-11-02T03:00:00.000Z',
    );
    expect(nextRun('weekly', new Date('2026-11-02T01:00:00Z')).toISOString()).toBe(
      '2026-11-02T03:00:00.000Z',
    );
    expect(nextRun('weekly', new Date('2026-11-02T05:00:00Z')).toISOString()).toBe(
      '2026-11-09T03:00:00.000Z',
    );
  });
});

describe('periodLabel', () => {
  it('names a month by its name', () => {
    expect(periodLabel('monthly', '2026-09-01---2026-09-30')).toBe('September 2026');
    expect(periodLabel('outsourced', '2026-10-01---2026-10-31')).toBe('October 2026');
  });

  it('gives a week, or a period that starts mid-month, as its two days', () => {
    expect(periodLabel('weekly', '2026-10-19---2026-10-25')).toBe('19 Oct 2026 – 25 Oct 2026');
    expect(periodLabel('monthly', '2026-09-15---2026-09-30')).toBe('15 Sept 2026 – 30 Sept 2026');
  });

  it('keeps a period it cannot read as stored', () => {
    expect(periodLabel('monthly', '2026-09')).toBe('2026-09');
  });
});
