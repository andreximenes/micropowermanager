import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const locationsRoute0 = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/locations',
  component: () => <h1 className="m-0 text-2xl font-bold">Locations</h1>,
});

export const locationRoutes = [locationsRoute0];
