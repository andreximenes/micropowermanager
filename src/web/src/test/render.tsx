import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, type ReactNode } from 'react';

import { createAppRouter } from '@/router';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Renders `ui` at `/` inside a minimal router, with a `/login` page to land on. */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  const rootRoute = createRootRoute();
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => ui }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/login',
        component: () => <p>Login page</p>,
      }),
    ]),
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { user, router, queryClient };
}

/** Renders `ui` with React Query only, for components that never navigate. */
export function renderWithQueryClient(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  const user = userEvent.setup();
  const view = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { user, queryClient, ...view };
}

/** Renders the real application router at `path`, as the browser would open it. */
export function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const queryClient = createTestQueryClient();
  const router = createAppRouter(queryClient);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { user, router, queryClient };
}
