import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const agentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/agents',
  component: () => <h1 className="m-0 text-2xl font-bold">Agents</h1>,
});

export const agentRoutes = [agentsRoute];
