import { createRoute } from '@tanstack/react-router';

import { rootRoute } from '@/routes/base';

const authRoute0 = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: () => <h1 className="m-0 text-2xl font-bold">Forgot password</h1>,
});

export const passwordRoutes = [authRoute0];
