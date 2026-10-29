import { Banner } from '@spark/ui/banner';
import { Card } from '@spark/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@spark/ui/table';
import { Tab, Tabs } from '@spark/ui/tabs';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { ClusterMap } from './ClusterMap';
import { DEFAULT_PERIOD, periodCopy, type DashboardSearch } from './periods';
import { RevenueChart } from './RevenueChart';

import { fetchMainSettings, fetchMapSettings } from '@/api/customers';
import {
  dashboardPeriods,
  fetchDashboardOverview,
  fetchTopAgents,
  type DashboardOverview,
  type DashboardPeriod,
  type RecentSale,
} from '@/api/dashboard';
import { fetchClusters, fetchMiniGrids } from '@/api/locations';
import { can, readSession } from '@/auth/session';
import { Kpi, KpiChange } from '@/components/Kpi';
import { formatDate, formatMoney, plural } from '@/lib/format';

const bucketLabels: Record<DashboardOverview['overdue']['buckets'][number]['bucket'], string> = {
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
};

const bucketColors: Record<DashboardOverview['overdue']['buckets'][number]['bucket'], string> = {
  '1-30': 'bg-teal',
  '31-60': 'bg-amber',
  '61-90': 'bg-red/70',
  '90+': 'bg-red',
};

function Section({
  title,
  action,
  className = '',
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`flex min-w-0 flex-col bg-panel ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">{children}</p>
  );
}

function LoadError({ what, error }: { what: string; error: Error }) {
  return (
    <div className="p-4">
      <Banner tone="error" role="alert">
        Could not load {what}: {error.message}
      </Banner>
    </div>
  );
}

function Kpis({
  overview,
  period,
  currency,
}: {
  overview: DashboardOverview;
  period: DashboardPeriod;
  currency: string;
}) {
  const copy = periodCopy[period];
  const { customers, products_sold, revenue, overdue, collection } = overview;
  const rate = collection.due > 0 ? Math.round((collection.paid / collection.due) * 100) : null;
  const overdueDetail = `${formatMoney(overdue.amount, currency)} overdue`;

  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5"
    >
      <Kpi
        label="Customers"
        value={customers.total.toLocaleString('en')}
        detail={
          <p
            className={`m-0 mt-0.5 text-xs ${customers.new > 0 ? 'text-green' : 'text-muted-foreground'}`}
          >
            +{customers.new.toLocaleString('en')} new {copy.name}
          </p>
        }
      />
      <Kpi
        label="Products sold"
        value={products_sold.current.toLocaleString('en')}
        detail={
          <KpiChange
            current={products_sold.current}
            past={products_sold.previous}
            changeAs="count"
            upIsGood
            comparedWith={copy.comparedWith}
          />
        }
      />
      <Kpi
        label="Revenue"
        value={formatMoney(revenue.current, currency)}
        detail={
          <KpiChange
            current={revenue.current}
            past={revenue.previous}
            changeAs="percent"
            upIsGood
            comparedWith={copy.comparedWith}
          />
        }
      />
      <Kpi
        label="Overdue customers"
        value={overdue.customers.toLocaleString('en')}
        valueClassName={overdue.customers > 0 ? 'text-red' : ''}
        detail={
          can(readSession(), 'customers') && overdue.customers > 0 ? (
            <Link
              to="/customers"
              search={{ overdue: true }}
              className="mt-0.5 block truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {overdueDetail} · See list
            </Link>
          ) : (
            <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{overdueDetail}</p>
          )
        }
      />
      <Kpi
        label="Collection rate"
        className="col-span-2 sm:col-span-1"
        value={rate === null ? '—' : `${rate}%`}
        detail={
          rate === null ? (
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">No installments fell due</p>
          ) : (
            <div
              role="progressbar"
              aria-label="Collection rate"
              aria-valuenow={rate}
              aria-valuemin={0}
              aria-valuemax={100}
              title={`${formatMoney(collection.paid, currency)} paid of ${formatMoney(collection.due, currency)} due`}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2"
            >
              <div
                className="h-full bg-gradient-to-r from-green-bright to-teal"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          )
        }
      />
    </section>
  );
}

function OverdueByAge({ overview, currency }: { overview: DashboardOverview; currency: string }) {
  const { buckets, customers } = overview.overdue;
  const most = Math.max(1, ...buckets.map((bucket) => bucket.customers));
  return (
    <Section
      title="Overdue by age"
      className="flex-[1_1_300px]"
      action={
        can(readSession(), 'customers') && customers > 0 ? (
          <Link
            to="/customers"
            search={{ overdue: true }}
            className="text-sm underline-offset-2 hover:underline"
          >
            See customers
          </Link>
        ) : null
      }
    >
      {customers === 0 ? (
        <Muted>No customer is behind on an installment.</Muted>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 px-4 py-4 text-sm sm:px-5">
          {buckets.map((bucket) => (
            <li key={bucket.bucket} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-2">
                <span>{bucketLabels[bucket.bucket]}</span>
                <strong className="whitespace-nowrap">
                  {bucket.customers.toLocaleString('en')} · {formatMoney(bucket.amount, currency)}
                </strong>
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
                <span
                  className={`block h-full ${bucketColors[bucket.bucket]}`}
                  style={{ width: `${(bucket.customers / most) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// The agents endpoint reads its end date as midnight, so the period's last day needs the next one.
function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function TopAgents({ overview, period }: { overview: DashboardOverview; period: DashboardPeriod }) {
  const { from, to } = overview.period;
  const agents = useQuery({
    queryKey: ['dashboard', 'top-agents', from, to],
    queryFn: () => fetchTopAgents(from, dayAfter(to)),
  });
  return (
    <Section
      title={`Top agents · ${periodCopy[period].name}`}
      className="flex-[1_1_320px]"
      action={
        <Link to="/agents" className="text-sm underline-offset-2 hover:underline">
          All agents
        </Link>
      }
    >
      {agents.isPending ? <Muted>Loading agents…</Muted> : null}
      {agents.isError ? <LoadError what="the agents" error={agents.error} /> : null}
      {agents.data?.length === 0 ? (
        <Muted>No agent sold a product {periodCopy[period].name}.</Muted>
      ) : null}
      {agents.data && agents.data.length > 0 ? (
        <Table aria-label="Top agents">
          <TableHeader>
            <TableRow className="text-xs tracking-wide uppercase hover:bg-transparent">
              <TableHead className="pl-4 font-semibold sm:pl-5">Agent</TableHead>
              <TableHead className="text-right font-semibold">Sales</TableHead>
              <TableHead className="pr-4 text-right font-semibold sm:pr-5">Customers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.data.map((agent, index) => (
              <TableRow key={`${agent.agent ?? ''}-${index}`}>
                <TableCell className="pl-4 sm:pl-5">{agent.agent || 'Unnamed agent'}</TableCell>
                <TableCell className="text-right">{agent.sales.toLocaleString('en')}</TableCell>
                <TableCell className="pr-4 text-right sm:pr-5">
                  {agent.customers.toLocaleString('en')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </Section>
  );
}

function MapCard() {
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: fetchClusters });
  const miniGrids = useQuery({ queryKey: ['mini-grids'], queryFn: fetchMiniGrids });
  const mapSettings = useQuery({ queryKey: ['map-settings'], queryFn: fetchMapSettings });
  const error = clusters.error ?? miniGrids.error;
  const ready = clusters.data && miniGrids.data && !mapSettings.isPending;
  const empty = clusters.data?.length === 0 && miniGrids.data?.length === 0;

  return (
    <Section title="Clusters on the map" className="flex-[1_1_300px]">
      {error ? <LoadError what="the clusters" error={error} /> : null}
      {!error && !ready ? <Muted>Loading the map…</Muted> : null}
      {ready && empty ? <Muted>No clusters or mini-grids are set up yet.</Muted> : null}
      {ready && !empty ? (
        <div className="p-4 sm:p-5">
          <ClusterMap
            clusters={clusters.data}
            miniGrids={miniGrids.data}
            view={mapSettings.data ?? null}
            label={`Map of ${plural(clusters.data.length, 'cluster')} and ${plural(miniGrids.data.length, 'mini-grid')}`}
            className="h-56 overflow-hidden rounded-md border border-border"
          />
        </div>
      ) : null}
    </Section>
  );
}

function saleAmount(sale: RecentSale, currency: string): string {
  if (sale.payment_type === 'energy_service') {
    return sale.price_per_day === null
      ? 'Pay per day'
      : `${formatMoney(sale.price_per_day, currency)}/day`;
  }
  return formatMoney(sale.total_cost, currency);
}

function RecentSales({ sales, currency }: { sales: RecentSale[]; currency: string }) {
  return (
    <Section title="Recent sales" className="flex-[1_1_300px]">
      {sales.length === 0 ? (
        <Muted>No products sold yet.</Muted>
      ) : (
        <ol aria-label="Recent sales" className="m-0 flex list-none flex-col p-2 text-sm">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link
                to="/contracts/$contractId"
                params={{ contractId: sale.id }}
                className="flex justify-between gap-3 rounded-md px-2 py-2 hover:bg-panel-2 sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {sale.customer.name} {sale.customer.surname}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[sale.product ?? 'Unknown product', sale.sold_by].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right whitespace-nowrap">
                  {saleAmount(sale, currency)}
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(sale.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function Dashboard({ search }: { search: DashboardSearch }) {
  const navigate = useNavigate({ from: '/dashboard' });
  const period = search.period ?? DEFAULT_PERIOD;
  const seesFigures = can(readSession(), 'transactions');
  const overview = useQuery({
    queryKey: ['dashboard', 'overview', period],
    queryFn: () => fetchDashboardOverview(period),
    placeholderData: keepPreviousData,
    enabled: seesFigures,
  });
  const settings = useQuery({ queryKey: ['main-settings'], queryFn: fetchMainSettings });
  const currency = settings.data?.currency ?? '';
  const data = overview.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-bold">Dashboard</h1>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">
            {data
              ? `Solar home system business · ${formatDate(data.period.from)} – ${formatDate(data.period.to)}`
              : 'Solar home system business'}
          </p>
        </div>
        {seesFigures ? (
          <Tabs role="radiogroup" aria-label="Period" className="max-w-full overflow-x-auto">
            {dashboardPeriods.map((value) => (
              <Tab
                key={value}
                role="radio"
                aria-checked={period === value}
                active={period === value}
                onClick={() =>
                  void navigate({
                    search: { period: value === DEFAULT_PERIOD ? undefined : value },
                    replace: true,
                  })
                }
                className="shrink-0 px-3"
              >
                {periodCopy[value].label}
              </Tab>
            ))}
          </Tabs>
        ) : null}
      </div>

      {!seesFigures ? (
        <Banner role="status">Sales and payment figures need the transactions permission.</Banner>
      ) : null}
      {overview.isError ? <LoadError what="the dashboard" error={overview.error} /> : null}
      {seesFigures && overview.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Loading figures…</p>
      ) : null}

      {data ? (
        <>
          <Kpis overview={data} period={period} currency={currency} />
          <div className="flex flex-wrap items-stretch gap-4">
            <Section
              title="Revenue by month"
              className="flex-[2_1_520px]"
              action={
                <span className="text-sm text-muted-foreground">
                  <span className="sm:hidden">Last 6 months</span>
                  <span className="hidden sm:inline">Last 12 months</span>
                </span>
              }
            >
              <div className="px-4 pt-3 pb-4 sm:px-5">
                <RevenueChart
                  months={data.revenue_by_month}
                  currency={currency}
                  className="hidden sm:block"
                />
                <RevenueChart
                  months={data.revenue_by_month.slice(-6)}
                  currency={currency}
                  className="sm:hidden"
                />
              </div>
            </Section>
            <OverdueByAge overview={data} currency={currency} />
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {data ? <TopAgents overview={data} period={period} /> : null}
        <MapCard />
        {data ? <RecentSales sales={data.recent_sales} currency={currency} /> : null}
      </div>
    </div>
  );
}
