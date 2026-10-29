import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const reportsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/reports',
  component: () => <h1 className="m-0 text-2xl font-bold">Reports</h1>,
});

export const reportRoutes = [reportsRoute];
