import { createRoute } from '@tanstack/react-router';

import { authenticatedRoute } from '@/routes/base';

const settingsRoute0 = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  component: () => <h1 className="m-0 text-2xl font-bold">Settings</h1>,
});

const settingsRoute1 = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/profile',
  component: () => <h1 className="m-0 text-2xl font-bold">Your profile</h1>,
});

export const settingsRoutes = [settingsRoute0, settingsRoute1];
