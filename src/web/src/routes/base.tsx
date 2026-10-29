import { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, Outlet, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { readSession } from '@/auth/session';
import { AppShell } from '@/components/AppShell';

type RouterContext = { queryClient: QueryClient };

export const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

export const authenticatedRoute = createRoute({
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

export const positiveId = z.coerce.number().int().positive();
