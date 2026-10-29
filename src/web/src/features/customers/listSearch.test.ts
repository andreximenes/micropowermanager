import { customerListSearchSchema, peopleQueryOf } from './listSearch';

describe('customerListSearchSchema', () => {
  it('reads a numeric search term as text', () => {
    expect(customerListSearchSchema.parse({ term: 6380 })).toMatchObject({ term: '6380' });
  });

  it('drops values it does not understand instead of failing the page', () => {
    expect(
      customerListSearchSchema.parse({
        status: 'rich',
        village: 'abc',
        per_page: 7,
        sort: 'phone',
        paid_from: '16/10/2026',
        page: 0,
      }),
    ).toEqual({});
  });
});

describe('peopleQueryOf', () => {
  it('asks for the newest customers first, 15 per page, by default', () => {
    expect(peopleQueryOf({})).toMatchObject({
      per_page: 15,
      sort_by: '-created_at',
      page: undefined,
    });
  });

  it('maps every filter to the API parameter', () => {
    expect(
      peopleQueryOf({
        term: '  Ami ',
        status: 'not_paying',
        village: 3,
        agent: 4,
        device: 'meter',
        overdue: true,
        paid_from: '2026-10-01',
        paid_to: '2026-10-20',
        registered_from: '2026-01-01',
        registered_to: '2026-02-01',
        page: 2,
        per_page: 50,
        sort: 'city',
      }),
    ).toEqual({
      term: 'Ami',
      active_customer: 0,
      city_id: 3,
      agent_id: 4,
      device_type: 'meter',
      overdue: 1,
      latest_payment_from: '2026-10-01',
      latest_payment_to: '2026-10-20',
      registration_from: '2026-01-01',
      registration_to: '2026-02-01',
      page: 2,
      per_page: 50,
      sort_by: 'city',
    });
    expect(peopleQueryOf({ status: 'paying', term: '  ' })).toMatchObject({
      active_customer: 1,
      term: undefined,
    });
  });
});
