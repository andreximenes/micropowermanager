import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const appliancesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/appliances',
  component: () => <h1 className="m-0 text-2xl font-bold">Appliances</h1>,
});

export const productRoutes = [appliancesRoute];
