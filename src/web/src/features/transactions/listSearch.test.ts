import { transactionListSearchSchema, transactionQueryOf } from './listSearch';

describe('transactionListSearchSchema', () => {
  it('keeps valid values and drops the rest instead of failing', () => {
    expect(
      transactionListSearchSchema.parse({
        period: 9,
        serial: 6380,
        status: 'lost',
        device: 'meter',
        from: '2026-10-01',
        to: 'yesterday',
        page: '2',
        per_page: 30,
        sort: '-amount',
        transaction: 'abc',
      }),
    ).toEqual({ serial: '6380', device: 'meter', from: '2026-10-01', page: 2, sort: '-amount' });
  });
});

describe('transactionQueryOf', () => {
  it('defaults to the newest 15 and maps the status to its provider code', () => {
    expect(transactionQueryOf({ status: 'cancelled', serial: '  ' })).toEqual({
      deviceType: undefined,
      provider: undefined,
      status: 3,
      serial_number: undefined,
      from: undefined,
      to: undefined,
      page: undefined,
      per_page: 15,
      sort_by: '-created_at',
    });
  });
});
