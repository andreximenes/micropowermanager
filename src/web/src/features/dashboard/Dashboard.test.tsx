import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import type { DashboardOverview } from '@/api/dashboard';
import { signIn } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

vi.mock('./ClusterMap', () => ({
  ClusterMap: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

const months = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];

function overviewFixture(overrides: Partial<DashboardOverview> = {}): DashboardOverview {
  return {
    period: {
      from: '2026-10-01',
      to: '2026-10-29',
      previous_from: '2026-09-01',
      previous_to: '2026-09-29',
    },
    customers: { total: 250, new: 27 },
    products_sold: { current: 31, previous: 25 },
    revenue: { current: 4_930_000, previous: 5_060_000 },
    collection: { due: 1000, paid: 870 },
    overdue: {
      customers: 41,
      amount: 650_000,
      buckets: [
        { bucket: '1-30', customers: 18, amount: 196_000 },
        { bucket: '31-60', customers: 14, amount: 212_000 },
        { bucket: '61-90', customers: 6, amount: 138_000 },
        { bucket: '90+', customers: 3, amount: 104_000 },
      ],
    },
    revenue_by_month: months.map((month, index) => ({ month, revenue: (index + 1) * 100_000 })),
    recent_sales: [
      {
        id: 12,
        customer: { id: 7, name: 'Blessing', surname: 'Danjuma' },
        product: 'Spark Steady Kit',
        total_cost: 144_000,
        payment_type: 'installment',
        price_per_day: null,
        sold_by: 'Musa',
        created_at: '2026-10-27T10:00:00Z',
      },
      {
        id: 13,
        customer: { id: 8, name: 'Ruth', surname: 'Bako' },
        product: null,
        total_cost: 0,
        payment_type: 'energy_service',
        price_per_day: 500,
        sold_by: null,
        created_at: '2026-10-26T10:00:00Z',
      },
    ],
    ...overrides,
  };
}

type Requests = { overview: URLSearchParams[]; agents: URLSearchParams[] };

function dashboardHandlers(overview = overviewFixture()): Requests {
  const requests: Requests = { overview: [], agents: [] };
  server.use(
    http.get('/api/dashboard/overview', ({ request }) => {
      requests.overview.push(new URL(request.url).searchParams);
      return HttpResponse.json({ data: overview });
    }),
    http.get('/api/dashboard/agents', ({ request }) => {
      requests.agents.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        data: {
          metrics: {},
          top_agents: [
            { agent: 'Musa', customers: 8, commission: '1200.00', sales: 9 },
            { agent: null, customers: '2', commission: null, sales: '3' },
          ],
          period: {},
        },
        status: 'success',
      });
    }),
    http.get('/api/clusters', () =>
      HttpResponse.json({
        data: [
          {
            id: 1,
            name: "Jema'a",
            geo_json: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [8.3, 9.5],
                    [8.4, 9.6],
                    [8.3, 9.6],
                  ],
                ],
              },
            },
          },
        ],
      }),
    ),
    http.get('/api/mini-grids', () =>
      HttpResponse.json({
        data: [
          {
            id: 1,
            name: 'Kafanchan',
            location: { geo_json: { geometry: { coordinates: [8.29, 9.58] } } },
          },
        ],
      }),
    ),
  );
  return requests;
}

const figures = () => screen.findByRole('region', { name: 'Key figures' });

describe('Dashboard', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows the period figures, each compared with the period before', async () => {
    const requests = dashboardHandlers();
    renderApp('/dashboard');

    const kpis = await figures();
    expect(kpis).toHaveTextContent('Customers250+27 new this month');
    expect(kpis).toHaveTextContent('Products sold31+6 vs the same days last month');
    expect(kpis).toHaveTextContent('RevenueTZS 4,930,000−2.6% vs the same days last month');
    expect(kpis).toHaveTextContent('Overdue customers41TZS 650,000 overdue · See list');
    expect(within(kpis).getByRole('progressbar', { name: 'Collection rate' })).toHaveAttribute(
      'aria-valuenow',
      '87',
    );
    expect(within(kpis).getByRole('link', { name: /See list/ })).toHaveAttribute(
      'href',
      '/customers?overdue=true',
    );
    expect(
      screen.getByText('Solar home system business · 01 Oct 2026 – 29 Oct 2026'),
    ).toBeInTheDocument();
    expect(requests.overview[0]?.get('period')).toBe('this_month');
  });

  it('charts revenue by month and lists the months for screen readers', async () => {
    dashboardHandlers();
    renderApp('/dashboard');

    expect(await screen.findAllByTestId('revenue-chart')).toHaveLength(2);
    const desktop = screen.getAllByRole('table', { name: /Revenue by month/ })[0] as HTMLElement;
    expect(desktop).toHaveAccessibleName('Revenue by month, November 2025 to October 2026');
    expect(
      within(desktop).getByRole('row', { name: 'October 2026 TZS 1,200,000' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Oct').length).toBeGreaterThan(0);
  });

  it('ages overdue customers in buckets', async () => {
    dashboardHandlers();
    renderApp('/dashboard');

    expect(await screen.findByText('1–30 days')).toBeInTheDocument();
    expect(screen.getByText('18 · TZS 196,000')).toBeInTheDocument();
    expect(screen.getByText('Over 90 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See customers' })).toHaveAttribute(
      'href',
      '/customers?overdue=true',
    );
  });

  it('lists the top agents for the period, asking through the end of its last day', async () => {
    const requests = dashboardHandlers();
    renderApp('/dashboard');

    const table = await screen.findByRole('table', { name: 'Top agents' });
    expect(await within(table).findByRole('row', { name: 'Musa 9 8' })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: 'Unnamed agent 3 2' })).toBeInTheDocument();
    expect(requests.agents[0]?.get('start_date')).toBe('2026-10-01');
    expect(requests.agents[0]?.get('end_date')).toBe('2026-10-30');
  });

  it('links each recent sale to its contract', async () => {
    dashboardHandlers();
    renderApp('/dashboard');

    const sales = await screen.findByRole('list', { name: 'Recent sales' });
    const [installment, energy] = within(sales).getAllByRole('link');
    expect(installment).toHaveAttribute('href', '/contracts/12');
    expect(installment).toHaveTextContent(
      'Blessing DanjumaSpark Steady Kit · MusaTZS 144,00027 Oct 2026',
    );
    expect(energy).toHaveTextContent('Unknown product');
    expect(energy).toHaveTextContent('TZS 500/day');
  });

  it('maps the clusters and mini-grids', async () => {
    dashboardHandlers();
    renderApp('/dashboard');

    expect(
      await screen.findByRole('img', { name: 'Map of 1 cluster and 1 mini-grid' }),
    ).toBeInTheDocument();
  });

  it('keeps the period in the URL and asks for it', async () => {
    const requests = dashboardHandlers();
    const { user, router } = renderApp('/dashboard');

    await user.click(await screen.findByRole('radio', { name: 'This year' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ period: 'this_year' }));
    await waitFor(() => expect(requests.overview.at(-1)?.get('period')).toBe('this_year'));
    expect(await screen.findByText('Top agents · this year')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'This month' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('says when nothing is overdue, sold or due', async () => {
    dashboardHandlers(
      overviewFixture({
        customers: { total: 3, new: 0 },
        collection: { due: 0, paid: 0 },
        overdue: {
          customers: 0,
          amount: 0,
          buckets: overviewFixture().overdue.buckets.map((bucket) => ({
            ...bucket,
            customers: 0,
            amount: 0,
          })),
        },
        recent_sales: [],
      }),
    );
    renderApp('/dashboard');

    const kpis = await figures();
    expect(kpis).toHaveTextContent('+0 new this month');
    expect(kpis).toHaveTextContent('Collection rate—No installments fell due');
    expect(within(kpis).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('No customer is behind on an installment.')).toBeInTheDocument();
    expect(screen.getByText('No products sold yet.')).toBeInTheDocument();
  });

  it('says when no agent sold in the period and when no clusters exist', async () => {
    dashboardHandlers();
    server.use(
      http.get('/api/dashboard/agents', () => HttpResponse.json({ data: { top_agents: [] } })),
      http.get('/api/clusters', () => HttpResponse.json({ data: [] })),
      http.get('/api/mini-grids', () => HttpResponse.json({ data: [] })),
    );
    renderApp('/dashboard');

    expect(await screen.findByText('No agent sold a product this month.')).toBeInTheDocument();
    expect(
      await screen.findByText('No clusters or mini-grids are set up yet.'),
    ).toBeInTheDocument();
  });

  it('reports what failed to load', async () => {
    dashboardHandlers();
    server.use(
      http.get('/api/dashboard/overview', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
      http.get('/api/clusters', () => HttpResponse.json({ message: 'Down' }, { status: 500 })),
    );
    renderApp('/dashboard');

    expect(
      await screen.findByText('Could not load the dashboard: Server Error'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Could not load the clusters: Down')).toBeInTheDocument();
  });

  it('reports when the agents fail to load', async () => {
    dashboardHandlers();
    server.use(
      http.get('/api/dashboard/agents', () =>
        HttpResponse.json({ message: 'Down' }, { status: 500 }),
      ),
    );
    renderApp('/dashboard');

    expect(await screen.findByText('Could not load the agents: Down')).toBeInTheDocument();
  });

  it('leaves out the figures for users without the transactions permission', async () => {
    signIn({ permissions: ['customers'] });
    const requests = dashboardHandlers();
    renderApp('/dashboard');

    expect(
      await screen.findByText('Sales and payment figures need the transactions permission.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Map of/ })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Period' })).not.toBeInTheDocument();
    expect(requests.overview).toHaveLength(0);
  });

  it('shows the overdue figure without links for users who cannot open customers', async () => {
    signIn({ permissions: ['transactions'] });
    dashboardHandlers();
    renderApp('/dashboard');

    const kpis = await figures();
    expect(kpis).toHaveTextContent('TZS 650,000 overdue');
    expect(within(kpis).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'See customers' })).not.toBeInTheDocument();
  });
});
