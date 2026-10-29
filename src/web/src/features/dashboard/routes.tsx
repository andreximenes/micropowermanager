import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/dashboard',
  component: () => <h1 className="m-0 text-2xl font-bold">Dashboard</h1>,
});

export const dashboardRoutes = [dashboardRoute];
