import { createRoute } from '@tanstack/react-router';

import { LocationsPage } from './LocationsPage';
import { locationsSearchSchema } from './search';

import { ImportPage } from '@/features/import/ImportPage';
import { authenticatedRoute } from '@/routes/base';

const locationsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/locations',
  validateSearch: locationsSearchSchema,
  component: function LocationsRoute() {
    return <LocationsPage search={locationsRoute.useSearch()} />;
  },
});

// Import lives under Settings in the menu, but is declared here so it can be built alongside.
const importRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings/import',
  component: ImportPage,
});

export const locationRoutes = [locationsRoute, importRoute];
