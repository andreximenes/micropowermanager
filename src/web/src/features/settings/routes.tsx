import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { settingsTabs, userListSearchSchema } from './listSearch';
import { Profile } from './Profile';
import { SettingsPage } from './SettingsPage';
import { UserList } from './UserList';

import { authenticatedRoute } from '@/routes/base';

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  validateSearch: z.object({ tab: z.enum(settingsTabs).optional().catch(undefined) }),
  component: function SettingsRoute() {
    const { tab } = settingsRoute.useSearch();
    return <SettingsPage tab={tab ?? 'company'} />;
  },
});

const usersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings/users',
  validateSearch: userListSearchSchema,
  component: function UsersRoute() {
    return <UserList search={usersRoute.useSearch()} />;
  },
});

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/profile',
  component: Profile,
});

export const settingsRoutes = [settingsRoute, usersRoute, profileRoute];
