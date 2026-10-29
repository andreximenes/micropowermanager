import { createRoute } from '@tanstack/react-router';

import { transactionListSearchSchema } from './listSearch';
import { TransactionList } from './TransactionList';

import { authenticatedRoute } from '@/routes/base';

// The open transaction is a search parameter, so its panel opens over the list as filtered.
const transactionsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/transactions',
  validateSearch: transactionListSearchSchema,
  component: function TransactionsRoute() {
    return <TransactionList search={transactionsRoute.useSearch()} />;
  },
});

export const transactionRoutes = [transactionsRoute];
