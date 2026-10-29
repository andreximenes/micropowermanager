import { z } from 'zod';

import { dashboardPeriods, type DashboardPeriod } from '@/api/dashboard';

export const DEFAULT_PERIOD: DashboardPeriod = 'this_month';

export const dashboardSearchSchema = z.object({
  period: z.enum(dashboardPeriods).optional().catch(undefined),
});
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>;

type PeriodCopy = {
  /** The segmented control's label. */
  label: string;
  /** Names the period on card titles: "Top agents · this month". */
  name: string;
  /** Ends each change line: "+8% vs the same days last month". */
  comparedWith: string;
};

export const periodCopy: Record<DashboardPeriod, PeriodCopy> = {
  this_month: { label: 'This month', name: 'this month', comparedWith: 'the same days last month' },
  last_30_days: { label: '30 days', name: 'last 30 days', comparedWith: 'the 30 days before' },
  last_3_months: {
    label: '3 months',
    name: 'last 3 months',
    comparedWith: 'the 3 months before',
  },
  this_year: { label: 'This year', name: 'this year', comparedWith: 'the same days last year' },
};
