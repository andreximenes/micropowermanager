import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { ReportList } from './ReportList';

import { reportTypes } from '@/api/reports';
import { authenticatedRoute } from '@/routes/base';

export const reportSearchSchema = z.object({
  type: z.enum(reportTypes).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});
export type ReportSearch = z.infer<typeof reportSearchSchema>;

const reportsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/reports',
  validateSearch: reportSearchSchema,
  component: function ReportsRoute() {
    return <ReportList search={reportsRoute.useSearch()} />;
  },
});

export const reportRoutes = [reportsRoute];
