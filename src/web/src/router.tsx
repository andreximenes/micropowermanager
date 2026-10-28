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
import { LoginPage } from '@/features/auth/LoginPage';
import { CustomerProfile } from '@/features/customer/CustomerProfile';
import { legacyHref } from '@/legacy';
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
  component: Outlet,
});

// The customer list is not rebuilt yet: the home page is the legacy one.
const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  beforeLoad: () => {
    window.location.replace(legacyHref('/people'));
  },
});

const customerRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/customers/$customerId',
  params: {
    parse: ({ customerId }) => ({ customerId: z.coerce.number().int().positive().parse(customerId) }),
    stringify: ({ customerId }) => ({ customerId: String(customerId) }),
  },
  component: function CustomerRoute() {
    const { customerId } = customerRoute.useParams();
    return <CustomerProfile customerId={customerId} />;
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([indexRoute, customerRoute]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient } });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
