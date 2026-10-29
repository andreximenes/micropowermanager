import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const ticketsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/tickets',
  component: () => <h1 className="m-0 text-2xl font-bold">Tickets</h1>,
});

export const ticketRoutes = [ticketsRoute];
