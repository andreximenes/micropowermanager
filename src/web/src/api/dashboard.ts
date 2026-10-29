import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

// Sums of decimal columns arrive as strings from some MySQL drivers.
const amount = z.coerce.number();

export const dashboardPeriods = [
  'this_month',
  'last_30_days',
  'last_3_months',
  'this_year',
] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export const overdueBuckets = ['1-30', '31-60', '61-90', '90+'] as const;

const overviewSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    previous_from: z.string(),
    previous_to: z.string(),
  }),
  customers: z.object({ total: z.number(), new: z.number() }),
  products_sold: z.object({ current: z.number(), previous: z.number() }),
  revenue: z.object({ current: amount, previous: amount }),
  collection: z.object({ due: amount, paid: amount }),
  overdue: z.object({
    customers: z.number(),
    amount,
    buckets: z.array(z.object({ bucket: z.enum(overdueBuckets), customers: z.number(), amount })),
  }),
  revenue_by_month: z.array(z.object({ month: z.string(), revenue: amount })),
  recent_sales: z.array(
    z.object({
      id: z.number(),
      customer: z.object({ id: z.number(), name: z.string(), surname: z.string() }),
      product: z.string().nullable(),
      total_cost: amount,
      payment_type: z.string(),
      price_per_day: amount.nullable(),
      sold_by: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});
export type DashboardOverview = z.infer<typeof overviewSchema>;
export type RecentSale = DashboardOverview['recent_sales'][number];

export const fetchDashboardOverview = async (period: DashboardPeriod) =>
  (await apiRequest('/dashboard/overview', dataOf(overviewSchema), { query: { period } })).data;

const topAgentSchema = z.object({
  // Only the agent's first name; the endpoint does not send the agent's id.
  agent: z.string().nullable(),
  sales: z.coerce.number(),
  customers: z.coerce.number(),
});
export type TopAgent = z.infer<typeof topAgentSchema>;

/** The agents who sold the most contracts between the two dates, best first. */
export const fetchTopAgents = async (from: string, to: string) =>
  (
    await apiRequest(
      '/dashboard/agents',
      dataOf(z.object({ top_agents: z.array(topAgentSchema) })),
      { query: { period: 'monthly', start_date: from, end_date: to } },
    )
  ).data.top_agents;

const lineStringSchema = z.array(z.tuple([z.number(), z.number()]));

const clusterSchema = z.object({
  id: z.number(),
  name: z.string(),
  geo_json: z
    .object({
      geometry: z
        .object({ type: z.string(), coordinates: z.array(lineStringSchema).catch([]) })
        .nullable()
        .optional(),
    })
    .nullable()
    .catch(null),
});
export type Cluster = z.infer<typeof clusterSchema>;

export const fetchClusters = async () =>
  (await apiRequest('/clusters', dataOf(z.array(clusterSchema)))).data;

const miniGridSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: z
    .object({
      geo_json: z
        .object({ geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }) })
        .nullable()
        .catch(null),
    })
    .nullable()
    .optional(),
});
export type MiniGrid = z.infer<typeof miniGridSchema>;

export const fetchMiniGrids = async () =>
  (await apiRequest('/mini-grids', dataOf(z.array(miniGridSchema)))).data;
