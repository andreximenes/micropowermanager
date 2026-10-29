import { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { readSession } from '@/auth/session';
import { AppShell } from '@/components/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { ContractDetail } from '@/features/contract/ContractDetail';
import { CustomerProfile } from '@/features/customer/CustomerProfile';
import { CustomerList } from '@/features/customers/CustomerList';
import { customerListSearchSchema } from '@/features/customers/listSearch';
import { safeRedirect } from '@/lib/redirect';

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: function LoginRoute() {
    const { redirect: target } = loginRoute.useSearch();
    return <LoginPage redirectTo={safeRedirect(target)} />;
  },
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ location }) => {
    if (!readSession()) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  // The shell stays mounted across screens; only the outlet changes.
  component: function AuthenticatedLayout() {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
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

const positiveId = z.coerce.number().int().positive();

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
  authenticatedRoute.addChildren([indexRoute, customersRoute, customerRoute, contractRoute]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient } });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
