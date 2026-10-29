import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const transactionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/transactions',
  component: () => <h1 className="m-0 text-2xl font-bold">Transactions</h1>,
});

export const transactionRoutes = [transactionsRoute];
