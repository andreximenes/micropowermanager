import { http, HttpResponse, type JsonBodyType } from 'msw';

import {
  countPeople,
  createPerson,
  deletePerson,
  exportCustomers,
  exportDebts,
  fetchAgents,
  fetchCity,
  fetchPeople,
  savePrimaryAddress,
  searchCities,
  updatePerson,
} from './people';

import { addressFixture, listedPersonFixture, paginator, signIn } from '@/test/fixtures';
import { server } from '@/test/server';

const details = {
  name: 'Blessing',
  surname: 'Danjuma',
  title: null,
  education: null,
  birth_date: '1990-04-02',
  gender: 'female',
};
const address = {
  email: null,
  phone: '+2348035550199',
  street: '12 Market Road',
  city_id: 3,
  points: '9.576210,8.298500',
};

function capture(method: 'get' | 'post' | 'put' | 'delete', path: string, response: JsonBodyType) {
  const seen: { url?: URL; body?: unknown } = {};
  server.use(
    http[method](path, async ({ request }) => {
      seen.url = new URL(request.url);
      seen.body =
        request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.json();
      return HttpResponse.json(response);
    }),
  );
  return seen;
}

describe('people API', () => {
  beforeEach(() => {
    signIn();
  });

  it('lists people and coerces the aggregates MySQL sends as strings', async () => {
    const seen = capture(
      'get',
      '/api/people',
      paginator([{ ...listedPersonFixture(), contracts_count: '1', outstanding_amount: '800.00' }]),
    );

    const result = await fetchPeople({ term: 'Ami', page: 2, overdue: 1 });

    expect(Object.fromEntries(seen.url?.searchParams ?? [])).toEqual({
      term: 'Ami',
      page: '2',
      overdue: '1',
    });
    expect(result.data[0]).toMatchObject({ contracts_count: 1, outstanding_amount: 800 });
  });

  it('counts people with a one-row page', async () => {
    const seen = capture('get', '/api/people', paginator([], { total: 41 }));

    await expect(countPeople({ overdue: 1 })).resolves.toBe(41);
    expect(seen.url?.search).toBe('?overdue=1&per_page=1');
  });

  it('searches villages and reads one village', async () => {
    const seen = capture(
      'get',
      '/api/cities',
      paginator([{ id: 3, name: 'Kafanchan', mini_grid: null }]),
    );
    server.use(
      http.get('/api/cities/3', () => HttpResponse.json({ data: { id: 3, name: 'Kafanchan' } })),
    );

    await expect(searchCities('Kaf')).resolves.toEqual([
      { id: 3, name: 'Kafanchan', mini_grid: null },
    ]);
    expect(seen.url?.search).toBe('?term=Kaf&per_page=30');
    await expect(fetchCity(3)).resolves.toEqual({ id: 3, name: 'Kafanchan' });
  });

  it('lists agents', async () => {
    capture(
      'get',
      '/api/agents',
      paginator([{ id: 1, person: { name: 'Musa', surname: 'Ibrahim' } }]),
    );

    await expect(fetchAgents()).resolves.toEqual([
      { id: 1, person: { name: 'Musa', surname: 'Ibrahim' } },
    ]);
  });

  it('creates a customer with a primary address and leaves blank fields out', async () => {
    const seen = capture('post', '/api/people', { data: { id: 99 } });

    await expect(createPerson(details, { ...address, country_code: 'NG' })).resolves.toEqual({
      id: 99,
    });
    expect(seen.body).toEqual({
      name: 'Blessing',
      surname: 'Danjuma',
      birth_date: '1990-04-02',
      gender: 'female',
      phone: '+2348035550199',
      street: '12 Market Road',
      city_id: 3,
      points: '9.576210,8.298500',
      country_code: 'NG',
      is_primary: true,
      is_customer: true,
    });
  });

  it('updates the person with every field, blanks included', async () => {
    const seen = capture('put', '/api/people/7', { data: { id: 7 } });

    await updatePerson(7, details);

    expect(seen.body).toEqual(details);
  });

  it('updates the primary address, or adds one when there is none', async () => {
    const put = capture('put', '/api/people/7/addresses', { data: addressFixture() });
    await savePrimaryAddress(7, 11, { ...address, points: null });
    expect(put.body).toEqual({
      id: 11,
      phone: '+2348035550199',
      street: '12 Market Road',
      city_id: 3,
      is_primary: 1,
    });

    const post = capture('post', '/api/people/7/addresses', { data: addressFixture() });
    await savePrimaryAddress(7, null, address);
    expect(post.body).not.toHaveProperty('id');
  });

  it('deletes a person', async () => {
    const seen = capture('delete', '/api/people/7', { message: 'Person deleted successfully' });

    await deletePerson(7);

    expect(seen.url?.pathname).toBe('/api/people/7');
  });

  it('downloads the exports with the file name the server gives', async () => {
    let customersQuery: string | undefined;
    server.use(
      http.get(
        '/api/export/debts',
        () =>
          new HttpResponse('xlsx', {
            headers: { 'Content-Disposition': 'attachment; filename=outstanding_debts.xlsx' },
          }),
      ),
      http.get('/api/export/customers', ({ request }) => {
        customersQuery = new URL(request.url).search;
        return new HttpResponse('xlsx', {
          headers: { 'Content-Disposition': `attachment; filename*=UTF-8''customers%20list.xlsx` },
        });
      }),
    );

    await expect(exportDebts()).resolves.toMatchObject({ filename: 'outstanding_debts.xlsx' });
    await expect(exportCustomers()).resolves.toMatchObject({ filename: 'customers list.xlsx' });
    expect(customersQuery).toBe('?format=excel');
  });

  it('names a download without Content-Disposition "export"', async () => {
    server.use(http.get('/api/export/debts', () => new HttpResponse('xlsx')));

    const file = await exportDebts();

    expect(file.filename).toBe('export');
    await expect(file.blob.text()).resolves.toBe('xlsx');
  });
});
