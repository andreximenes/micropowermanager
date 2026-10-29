import { QueryClient } from '@tanstack/react-query';
import { createRoute, createRouter, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { LoginPage } from '@/features/auth/LoginPage';
import { ContractDetail } from '@/features/contract/ContractDetail';
import { CustomerProfile } from '@/features/customer/CustomerProfile';
import { CustomerList } from '@/features/customers/CustomerList';
import { customerListSearchSchema } from '@/features/customers/listSearch';
import { agentRoutes } from '@/features/agents/routes';
import { dashboardRoutes } from '@/features/dashboard/routes';
import { productRoutes } from '@/features/products/routes';
import { reportRoutes } from '@/features/reports/routes';
import { ticketRoutes } from '@/features/tickets/routes';
import { transactionRoutes } from '@/features/transactions/routes';
import { safeRedirect } from '@/lib/redirect';
import { authenticatedRoute, positiveId, rootRoute } from '@/routes/base';

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: function LoginRoute() {
    const { redirect: target } = loginRoute.useSearch();
    return <LoginPage redirectTo={safeRedirect(target)} />;
  },
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/customers' });
  },
});

const customersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/customers',
  validateSearch: customerListSearchSchema,
  component: function CustomersRoute() {
    return <CustomerList search={customersRoute.useSearch()} />;
  },
});

const customerRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/customers/$customerId',
  params: {
    parse: ({ customerId }) => ({ customerId: positiveId.parse(customerId) }),
    stringify: ({ customerId }) => ({ customerId: String(customerId) }),
  },
  component: function CustomerRoute() {
    const { customerId } = customerRoute.useParams();
    return <CustomerProfile customerId={customerId} />;
  },
});

const contractRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/contracts/$contractId',
  params: {
    parse: ({ contractId }) => ({ contractId: positiveId.parse(contractId) }),
    stringify: ({ contractId }) => ({ contractId: String(contractId) }),
  },
  component: function ContractRoute() {
    const { contractId } = contractRoute.useParams();
    return <ContractDetail contractId={contractId} />;
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  // Each feature declares its own routes, so screens can be built side by side.
  authenticatedRoute.addChildren([
    indexRoute,
    customersRoute,
    customerRoute,
    contractRoute,
    ...transactionRoutes,
    ...productRoutes,
    ...ticketRoutes,
    ...agentRoutes,
    ...dashboardRoutes,
    ...reportRoutes,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient } });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
