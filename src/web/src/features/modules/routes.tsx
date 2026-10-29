import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { moduleKeys } from './catalog';
import { ModulePlaceholder } from './ModulePlaceholder';

import { authenticatedRoute } from '@/routes/base';

const moduleRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/modules/$moduleKey',
  params: {
    parse: ({ moduleKey }) => ({ moduleKey: z.enum(moduleKeys).parse(moduleKey) }),
    stringify: ({ moduleKey }) => ({ moduleKey }),
  },
  component: function ModuleRoute() {
    const { moduleKey } = moduleRoute.useParams();
    return <ModulePlaceholder moduleKey={moduleKey} />;
  },
});

export const moduleRoutes = [moduleRoute];
