import { createRoute } from '@tanstack/react-router';

import { Dashboard } from './Dashboard';
import { dashboardSearchSchema } from './periods';

import { authenticatedRoute } from '@/routes/base';

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  validateSearch: dashboardSearchSchema,
  component: function DashboardRoute() {
    return <Dashboard search={dashboardRoute.useSearch()} />;
  },
});

export const dashboardRoutes = [dashboardRoute];
